import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { requestScopeStore } from '../auth/context/request-scope';
import type { JwtPayload } from '../auth/types/auth.types';
import { GroqService, type AnalisisProspecto } from '../integraciones/groq.service';
import { MetaApiService } from '../integraciones/meta-api.service';
import { SupabaseStorageService } from '../integraciones/supabase-storage.service';
import { normalizarTelefono } from './whatsapp-signature.util';
import type {
  AsignarConversacionDto,
  CambiarModoDto,
  ConfirmarSolicitudVisitaDto,
  CrearSolicitudVisitaDesdeConversacionDto,
  EnviarMensajeDto,
  FindConversacionesQueryDto,
} from './dto/whatsapp.dto';

const MINUTOS_LIMITE_RESPUESTA = 15;
const MENSAJES_CONTEXTO_IA = 12;

const USUARIO_SISTEMA: JwtPayload = {
  sub: 'system',
  empresaId: 'system',
  rolId: 'system',
  rolNombre: 'ADMIN',
  correo: 'system@crm',
  nombres: 'Sistema',
  apellidos: 'WhatsApp',
};

type EmpresaWa = { id: string; nombre: string; waPhoneNumberId: string | null; waActivo: boolean };

function separarNombre(
  nombrePerfil?: string | null,
  telefono?: string,
): { nombres: string; apellidos: string } {
  const limpio = String(nombrePerfil ?? '').trim();
  if (!limpio) return { nombres: 'Prospecto WhatsApp', apellidos: `+${telefono ?? ''}` };
  const partes = limpio.split(/\s+/);
  const primero = partes[0] ?? 'Prospecto WhatsApp';
  if (partes.length === 1) return { nombres: primero, apellidos: '(WhatsApp)' };
  return { nombres: primero, apellidos: partes.slice(1).join(' ') };
}

function clasificarError(errores: any[] | undefined): { codigo: string; detalle: string } | null {
  const primero = Array.isArray(errores) ? errores[0] : null;
  if (!primero) return null;
  return {
    codigo: String(primero?.code ?? 'ERROR'),
    detalle: String(primero?.title ?? primero?.message ?? 'Error reportado por Meta').slice(0, 500),
  };
}

type ContenidoEntrante = {
  contenido: string | null;
  tipoMensaje: string;
  mediaId: string | null;
  mimeType: string | null;
};

function extraerContenido(msg: any): ContenidoEntrante {
  const tipo = msg?.type;
  switch (tipo) {
    case 'text':
      return { contenido: msg.text?.body ?? '', tipoMensaje: 'TEXTO', mediaId: null, mimeType: null };
    case 'image':
      return { contenido: msg.image?.caption ?? null, tipoMensaje: 'IMAGEN', mediaId: msg.image?.id ?? null, mimeType: msg.image?.mime_type ?? null };
    case 'video':
      return { contenido: msg.video?.caption ?? null, tipoMensaje: 'VIDEO', mediaId: msg.video?.id ?? null, mimeType: msg.video?.mime_type ?? null };
    case 'audio':
      return { contenido: null, tipoMensaje: 'AUDIO', mediaId: msg.audio?.id ?? null, mimeType: msg.audio?.mime_type ?? null };
    case 'document':
      return { contenido: msg.document?.caption ?? msg.document?.filename ?? null, tipoMensaje: 'DOCUMENTO', mediaId: msg.document?.id ?? null, mimeType: msg.document?.mime_type ?? null };
    case 'sticker':
      return { contenido: null, tipoMensaje: 'STICKER', mediaId: msg.sticker?.id ?? null, mimeType: msg.sticker?.mime_type ?? null };
    case 'location':
      return {
        contenido: [msg.location?.name, msg.location?.address, `${msg.location?.latitude},${msg.location?.longitude}`].filter(Boolean).join(' | ') || null,
        tipoMensaje: 'UBICACION',
        mediaId: null,
        mimeType: null,
      };
    case 'button':
      return { contenido: msg.button?.text ?? null, tipoMensaje: 'INTERACTIVO', mediaId: null, mimeType: null };
    case 'interactive':
      return {
        contenido:
          msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? null,
        tipoMensaje: 'INTERACTIVO',
        mediaId: null,
        mimeType: null,
      };
    default:
      return { contenido: null, tipoMensaje: 'SISTEMA', mediaId: null, mimeType: null };
  }
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly meta: MetaApiService,
    private readonly groq: GroqService,
    private readonly storage: SupabaseStorageService,
  ) {}

  // ===================================================================
  // Contexto multiempresa
  // ===================================================================

  private conScope<T>(empresaId: string, fn: () => Promise<T>): Promise<T> {
    const user: JwtPayload = { ...USUARIO_SISTEMA, empresaId };
    return requestScopeStore.run({ user, rutaEmpresaId: empresaId }, fn);
  }

  async resolverEmpresaPorPhoneNumberId(phoneNumberId: string): Promise<EmpresaWa | null> {
    return this.prisma.empresa.findFirst({
      where: { waPhoneNumberId: phoneNumberId, active: true, deletedAt: null },
      select: { id: true, nombre: true, waPhoneNumberId: true, waActivo: true },
    });
  }

  // ===================================================================
  // Webhook
  // ===================================================================

  async procesarWebhook(payload: any): Promise<void> {
    const entries: any[] = Array.isArray(payload?.entry) ? payload.entry : [];
    for (const entry of entries) {
      const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value ?? {};
        const phoneNumberId: string | undefined = value?.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        const empresa = await this.resolverEmpresaPorPhoneNumberId(phoneNumberId);
        if (!empresa) {
          this.logger.warn(`Webhook para phone_number_id desconocido: ${phoneNumberId}`);
          continue;
        }

        await this.conScope(empresa.id, async () => {
          const mensajes: any[] = Array.isArray(value.messages) ? value.messages : [];
          for (const msg of mensajes) {
            try {
              await this.procesarMensajeEntrante(empresa, value, msg);
            } catch (e: any) {
              this.logger.error(`Error procesando mensaje ${msg?.id}: ${e?.message ?? e}`);
            }
          }
          const estados: any[] = Array.isArray(value.statuses) ? value.statuses : [];
          for (const st of estados) {
            try {
              await this.procesarEstado(empresa.id, st);
            } catch (e: any) {
              this.logger.error(`Error procesando estado ${st?.id}: ${e?.message ?? e}`);
            }
          }
        });
      }
    }
  }

  private async registrarEvento(
    empresaId: string,
    eventoId: string,
    waMessageId: string | undefined,
    tipo: string | undefined,
  ): Promise<boolean> {
    try {
      await this.prisma.whatsappEventoProcesado.create({
        data: { empresaId, eventoId, waMessageId: waMessageId ?? null, tipo: tipo ?? null },
      });
      return false;
    } catch (e: any) {
      if (e?.code === 'P2002') return true;
      this.logger.warn(`No se pudo registrar el evento ${eventoId}: ${e?.message ?? e}`);
      return false;
    }
  }

  private async procesarEstado(empresaId: string, st: any) {
    const waMessageId: string | undefined = st?.id;
    if (!waMessageId) return;
    const estado = String(st?.status ?? '').toUpperCase();
    const mapa: Record<string, string> = {
      SENT: 'ENVIADO',
      DELIVERED: 'ENTREGADO',
      READ: 'LEIDO',
      FAILED: 'FALLIDO',
    };
    const nuevoEstado = mapa[estado];
    if (!nuevoEstado) return;

    if (await this.registrarEvento(empresaId, `status:${waMessageId}:${estado}`, waMessageId, 'STATUS')) return;

    const error = clasificarError(st?.errors);
    await this.prisma.mensajeWhatsapp.updateMany({
      where: { waMessageId },
      data: {
        waStatus: nuevoEstado as any,
        ...(error ? { errorCode: error.codigo, errorDetalle: error.detalle } : {}),
      },
    });
  }

  private async procesarMensajeEntrante(empresa: EmpresaWa, value: any, msg: any) {
    const waMessageId: string = msg?.id;
    if (!waMessageId) return;
    if (await this.registrarEvento(empresa.id, waMessageId, waMessageId, String(msg?.type ?? ''))) return;

    const telefono = normalizarTelefono(msg?.from);
    if (!telefono) return;

    const nombrePerfil: string | null =
      value?.contacts?.find((c: any) => c?.wa_id === msg?.from)?.profile?.name ?? null;
    const referral = msg?.referral && typeof msg.referral === 'object' ? msg.referral : null;

    const campana = await this.resolverCampana(referral);
    const cliente = await this.asegurarCliente(empresa.id, telefono, nombrePerfil, campana?.id ?? null);
    const conversacion = await this.asegurarConversacion(
      empresa.id,
      telefono,
      nombrePerfil,
      cliente?.id ?? null,
      campana?.id ?? null,
      referral,
    );

    const { contenido, tipoMensaje, mediaId, mimeType } = extraerContenido(msg);

    const mensaje = await this.prisma.mensajeWhatsapp.create({
      data: {
        waMessageId,
        direccion: 'ENTRANTE',
        remitenteTipo: 'CLIENTE',
        remitenteNombre: nombrePerfil,
        contenido,
        tipoMensaje: tipoMensaje as any,
        mediaId,
        mediaMimeType: mimeType,
        waStatus: 'ENTREGADO',
        timestampMeta: msg?.timestamp ? new Date(Number(msg.timestamp) * 1000) : null,
        empresaId: empresa.id,
        conversacionId: conversacion.id,
      },
    });

    if (mediaId) {
      await this.guardarMediaEntrante(empresa.id, conversacion.id, mensaje.id, mediaId);
    }

    await this.prisma.conversacionWhatsapp.update({
      where: { id: conversacion.id },
      data: { ultimaActividad: new Date() },
    });

    const iaActiva = conversacion.modoAtencion === 'IA' && conversacion.iaActiva;
    if (!iaActiva) return;

    if (!this.groq.configurado) {
      this.logger.warn('Conversación en modo IA pero GROQ_API_KEY no está configurado. Se omite la respuesta automática.');
      return;
    }

    await this.responderConIa(empresa, conversacion, telefono, contenido);
  }

  private async guardarMediaEntrante(
    empresaId: string,
    conversacionId: string,
    mensajeId: string,
    mediaId: string,
  ) {
    if (!this.storage.configurado) return;
    try {
      const media = await this.meta.descargarMedia(mediaId);
      const path = await this.storage.subirArchivo(
        `empresas/${empresaId}/conversaciones/${conversacionId}`,
        media.fileName,
        media.buffer,
        media.mimeType,
      );
      await this.prisma.mensajeWhatsapp.update({
        where: { id: mensajeId },
        data: { mediaStoragePath: path, mediaMimeType: media.mimeType },
      });
    } catch (e: any) {
      this.logger.warn(`No se pudo archivar la media ${mediaId}: ${e?.message ?? e}`);
    }
  }

  private async resolverCampana(referral: any | null) {
    if (!referral) return null;
    const adId = referral?.source_id ?? referral?.ad_id;
    if (!adId) return null;
    return this.prisma.campana.findFirst({
      where: { adId: String(adId), active: true, deletedAt: null },
      select: { id: true },
    });
  }

  private async asegurarCliente(
    empresaId: string,
    telefono: string,
    nombrePerfil: string | null,
    campanaId: string | null,
  ) {
    const existente = await this.prisma.cliente.findFirst({
      where: { celular: telefono, active: true, deletedAt: null },
      select: { id: true, consentimientoDatos: true },
    });
    if (existente) return existente;

    const { nombres, apellidos } = separarNombre(nombrePerfil, telefono);
    return this.prisma.cliente.create({
      data: {
        empresaId,
        nombres,
        apellidos,
        celular: telefono,
        medioCaptacion: 'WHATSAPP',
        estado: 'NUEVO',
        campanaId,
      },
      select: { id: true, consentimientoDatos: true },
    });
  }

  private async asegurarConversacion(
    empresaId: string,
    telefono: string,
    nombrePerfil: string | null,
    clienteId: string | null,
    campanaId: string | null,
    referral: any | null,
  ) {
    const existente = await this.prisma.conversacionWhatsapp.findFirst({
      where: { waContactPhone: telefono },
    });

    if (existente) {
      return this.prisma.conversacionWhatsapp.update({
        where: { id: existente.id },
        data: {
          ultimaActividad: new Date(),
          ...(nombrePerfil ? { waContactName: nombrePerfil } : {}),
          ...(clienteId && !existente.clienteId ? { clienteId } : {}),
          ...(campanaId && !existente.campanaId ? { campanaId } : {}),
        },
      });
    }

    return this.prisma.conversacionWhatsapp.create({
      data: {
        empresaId,
        waContactPhone: telefono,
        waContactName: nombrePerfil,
        clienteId,
        campanaId,
        ...(referral ? { referral } : {}),
        estado: 'ATENCION_IA',
        modoAtencion: 'IA',
        iaActiva: true,
        ultimaActividad: new Date(),
      },
    });
  }

  private async obtenerHistorial(conversacionId: string) {
    const mensajes = await this.prisma.mensajeWhatsapp.findMany({
      where: { conversacionId, active: true, deletedAt: null, contenido: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: MENSAJES_CONTEXTO_IA,
      select: { direccion: true, remitenteTipo: true, contenido: true, createdAt: true },
    });
    return mensajes
      .reverse()
      .map((m: any) => ({
        autor: (m.direccion === 'ENTRANTE' ? 'CLIENTE' : m.remitenteTipo === 'IA' ? 'IA' : 'ASESOR') as
          | 'CLIENTE'
          | 'IA'
          | 'ASESOR',
        contenido: String(m.contenido ?? ''),
      }))
      .filter((m: any) => m.contenido.trim().length > 0);
  }

  /**
   * Catálogo real que la IA puede usar para orientar la conversación.
   * IMPORTANTE: no se incluye el precio (regla comercial del spec §4).
   */
  private async obtenerCatalogoActivos() {
    const [proyectos, propiedades] = await Promise.all([
      this.prisma.proyecto.findMany({
        where: { active: true, deletedAt: null },
        take: 15,
        select: { nombre: true, distrito: true, ciudad: true, descripcion: true },
      }),
      this.prisma.propiedad.findMany({
        where: { active: true, deletedAt: null },
        take: 15,
        select: {
          codigoInterno: true,
          nombre: true,
          tipoPropiedad: true,
          estado: true,
          areaTotal: true,
          habitaciones: true,
          banos: true,
          distrito: true,
          proyecto: { select: { nombre: true } },
        },
      }),
    ]);

    return {
      proyectos: (proyectos as any[]).map((p) =>
        [
          p.nombre,
          [p.distrito, p.ciudad].filter(Boolean).join(', '),
          p.descripcion,
        ]
          .filter(Boolean)
          .join(' | '),
      ),
      propiedades: (propiedades as any[]).map((p) =>
        [
          `${p.codigoInterno} - ${p.nombre}`,
          p.tipoPropiedad,
          p.proyecto?.nombre ? `Proyecto: ${p.proyecto.nombre}` : null,
          p.estado,
          p.areaTotal ? `${Number(p.areaTotal)} m²` : null,
          p.habitaciones ? `${p.habitaciones} dorm.` : null,
          p.banos ? `${p.banos} baños` : null,
          p.distrito,
        ]
          .filter(Boolean)
          .join(' | '),
      ),
    };
  }

  private async responderConIa(
    empresa: EmpresaWa,
    conversacion: any,
    telefono: string,
    mensajeActual: string | null,
  ) {
    const [historial, activos] = await Promise.all([
      this.obtenerHistorial(conversacion.id),
      this.obtenerCatalogoActivos(),
    ]);

    let analisis: AnalisisProspecto;
    try {
      analisis = await this.groq.analizarConversacion({
        empresaNombre: empresa.nombre,
        mensajeActual: mensajeActual?.trim() || '[El cliente envió un archivo multimedia sin texto]',
        historial: historial.slice(0, -1),
        activos,
      });
    } catch (e: any) {
      this.logger.error(`Groq no pudo analizar la conversación ${conversacion.id}: ${e?.message ?? e}`);
      await this.transferirAAsesor(
        empresa,
        conversacion,
        'La IA no pudo procesar el mensaje (fallo técnico).',
        'Requiere atención manual.',
      );
      return;
    }

    await this.guardarCalificacion(empresa, conversacion, analisis);

    if (analisis.respuesta) {
      await this.enviarYRegistrar(empresa, conversacion, telefono, analisis.respuesta, 'IA');
    }

    if (analisis.transferir) {
      await this.transferirAAsesor(
        empresa,
        conversacion,
        analisis.motivoTransferencia ?? 'El cliente requiere atención personalizada.',
        analisis.resumenComercial ?? null,
      );
      return;
    }

    await this.prisma.conversacionWhatsapp.update({
      where: { id: conversacion.id },
      data: {
        ultimaActividad: new Date(),
        ...(analisis.resumenComercial ? { resumenComercial: analisis.resumenComercial } : {}),
      },
    });
  }

  private async guardarCalificacion(empresa: EmpresaWa, conversacion: any, analisis: AnalisisProspecto) {
    const cal = analisis.calificacion;
    if (!cal) return;

    const datos = {
      nombresCompletos: cal.nombresCompletos ?? null,
      tipoInmueble: cal.tipoInmueble ?? null,
      ubicacionDeseada: cal.ubicacionDeseada ?? null,
      presupuesto: cal.presupuesto ?? null,
      inicialDisponible: cal.inicialDisponible ?? null,
      intencionCompra: cal.intencionCompra ?? null,
      interesVisita: Boolean(cal.interesVisita),
      dni: cal.dni ?? null,
      consentimientoDatos: Boolean(analisis.consentimientoDatos),
      ...(analisis.consentimientoDatos ? { fechaConsentimiento: new Date() } : {}),
      datosJson: cal as any,
    };

    await this.prisma.calificacionProspecto.upsert({
      where: { conversacionId: conversacion.id },
      create: {
        empresaId: empresa.id,
        conversacionId: conversacion.id,
        clienteId: conversacion.clienteId ?? null,
        alcanzaMinimo: Boolean(cal.presupuesto || cal.inicialDisponible),
        ...datos,
      },
      update: {
        ...datos,
        clienteId: conversacion.clienteId ?? undefined,
      },
    });

    if (analisis.consentimientoDatos && conversacion.clienteId) {
      await this.prisma.cliente.update({
        where: { id: conversacion.clienteId },
        data: { consentimientoDatos: true, fechaConsentimiento: new Date() },
      });
    }
  }

  // ===================================================================
  // Envío de mensajes
  // ===================================================================

  private async enviarYRegistrar(
    empresa: EmpresaWa,
    conversacion: any,
    telefono: string,
    texto: string,
    remitenteTipo: 'IA' | 'ASESOR' | 'SISTEMA',
    remitenteUsuarioId?: string,
  ) {
    if (!empresa.waPhoneNumberId) {
      this.logger.warn(`Empresa ${empresa.id} sin waPhoneNumberId configurado. Mensaje no enviado.`);
      return null;
    }

    const resultado = await this.meta.enviarTexto(empresa.waPhoneNumberId, telefono, texto);

    return this.prisma.mensajeWhatsapp.create({
      data: {
        waMessageId: resultado.messageId ?? null,
        direccion: 'SALIENTE',
        remitenteTipo: remitenteTipo as any,
        contenido: texto,
        tipoMensaje: 'TEXTO',
        waStatus: (resultado.ok ? 'ENVIADO' : 'FALLIDO') as any,
        errorCode: resultado.errorCode ?? null,
        errorDetalle: resultado.errorDetalle ?? null,
        empresaId: empresa.id,
        conversacionId: conversacion.id,
        remitenteUsuarioId: remitenteUsuarioId ?? null,
      },
    });
  }

  // ===================================================================
  // Asignación y escalamiento
  // ===================================================================

  private async elegirAsesorConMenorCarga(): Promise<string | null> {
    const asesores: any[] = await this.prisma.usuario.findMany({
      where: { active: true, deletedAt: null, rol: { nombre: 'ASESOR' } },
      select: { id: true },
    });
    if (!asesores.length) return null;

    let mejor: { id: string; carga: number } | null = null;
    for (const a of asesores) {
      const carga = await this.prisma.asignacionConversacion.count({
        where: { asesorId: a.id, estado: 'PENDIENTE', active: true, deletedAt: null },
      });
      if (!mejor || carga < mejor.carga) mejor = { id: a.id, carga };
    }
    return mejor?.id ?? null;
  }

  async transferirAAsesor(
    empresa: EmpresaWa,
    conversacion: any,
    motivo: string,
    resumen: string | null,
    asesorIdPreferido?: string | null,
  ) {
    const asesorId = asesorIdPreferido ?? (await this.elegirAsesorConMenorCarga());
    if (!asesorId) {
      this.logger.warn(`No hay asesores disponibles en la empresa ${empresa.id} para asignar la conversación.`);
      return null;
    }

    const ahora = new Date();
    const limite = new Date(ahora.getTime() + MINUTOS_LIMITE_RESPUESTA * 60 * 1000);

    const asignacion = await this.prisma.asignacionConversacion.create({
      data: {
        empresaId: empresa.id,
        conversacionId: conversacion.id,
        asesorId,
        motivo: motivo.slice(0, 255),
        resumenComercial: resumen,
        fechaAsignacion: ahora,
        fechaLimiteRespuesta: limite,
        estado: 'PENDIENTE',
      },
    });

    await this.prisma.conversacionWhatsapp.update({
      where: { id: conversacion.id },
      data: {
        asesorId,
        estado: 'PENDIENTE_ASESOR',
        modoAtencion: 'HUMANA',
        iaActiva: false,
        motivoTransferencia: motivo.slice(0, 255),
        fechaTransferencia: ahora,
        ...(resumen ? { resumenComercial: resumen } : {}),
      },
    });

    const titulo = `Conversación asignada: ${conversacion.waContactName ?? conversacion.waContactPhone}`;
    const mensaje = [motivo, resumen].filter(Boolean).join(' | ') || null;
    await this.prisma.notificacion.upsert({
      where: {
        empresaId_asesorId_tipo_entidadId: {
          empresaId: empresa.id,
          asesorId,
          tipo: 'CONVERSACION_ASIGNADA' as any,
          entidadId: asignacion.id,
        },
      },
      create: {
        empresaId: empresa.id,
        asesorId,
        tipo: 'CONVERSACION_ASIGNADA' as any,
        titulo,
        mensaje,
        entidadId: asignacion.id,
        entidadTipo: 'AsignacionConversacion',
        fechaNotificacion: ahora,
      },
      update: { titulo, mensaje, leida: false, fechaNotificacion: ahora, active: true, deletedAt: null },
    });

    return asignacion;
  }

  /** Endpoint para cron externo: marca asignaciones vencidas y alerta a los administradores. */
  async escalarAsignacionesVencidas() {
    const empresas: any[] = await this.prisma.empresa.findMany({
      where: { active: true, deletedAt: null },
      select: { id: true },
    });

    let escaladas = 0;
    for (const empresa of empresas) {
      escaladas += await this.conScope(empresa.id, () => this.escalarEmpresa(empresa.id));
    }
    return { escaladas };
  }

  private async escalarEmpresa(empresaId: string): Promise<number> {
    const vencidas: any[] = await this.prisma.asignacionConversacion.findMany({
      where: {
        estado: 'PENDIENTE',
        alertaEscalada: false,
        active: true,
        deletedAt: null,
        fechaLimiteRespuesta: { lt: new Date() },
      },
      include: {
        conversacion: { select: { id: true, waContactName: true, waContactPhone: true } },
        asesor: { select: { id: true, nombres: true, apellidos: true } },
      },
    });
    if (!vencidas.length) return 0;

    const admins: any[] = await this.prisma.usuario.findMany({
      where: { active: true, deletedAt: null, rol: { nombre: 'ADMIN' } },
      select: { id: true },
    });

    const ahora = new Date();
    for (const a of vencidas) {
      await this.prisma.asignacionConversacion.update({
        where: { id: a.id },
        data: { alertaEscalada: true, estado: 'EXPIRADA' },
      });

      const titulo = `Conversación sin respuesta: ${a.conversacion?.waContactName ?? a.conversacion?.waContactPhone ?? ''}`;
      const mensaje = `El asesor ${a.asesor?.nombres ?? ''} ${a.asesor?.apellidos ?? ''} no respondió en ${MINUTOS_LIMITE_RESPUESTA} minutos.`;

      for (const admin of admins) {
        await this.prisma.notificacion.upsert({
          where: {
            empresaId_asesorId_tipo_entidadId: {
              empresaId,
              asesorId: admin.id,
              tipo: 'CONVERSACION_SIN_RESPUESTA' as any,
              entidadId: a.id,
            },
          },
          create: {
            empresaId,
            asesorId: admin.id,
            tipo: 'CONVERSACION_SIN_RESPUESTA' as any,
            titulo,
            mensaje,
            entidadId: a.id,
            entidadTipo: 'AsignacionConversacion',
            fechaNotificacion: ahora,
          },
          update: { titulo, mensaje, leida: false, fechaNotificacion: ahora, active: true, deletedAt: null },
        });
      }
    }

    return vencidas.length;
  }

  // ===================================================================
  // Bandeja (inbox)
  // ===================================================================

  async findAllConversaciones(empresaId: string, user: JwtPayload, dto: FindConversacionesQueryDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {
      empresaId,
      active: true,
      deletedAt: null,
      ...(dto.estado ? { estado: dto.estado } : {}),
      ...(dto.modoAtencion ? { modoAtencion: dto.modoAtencion } : {}),
      ...(dto.asesorId ? { asesorId: dto.asesorId } : {}),
      ...(dto.buscar
        ? {
            OR: [
              { waContactName: { contains: dto.buscar, mode: 'insensitive' } },
              { waContactPhone: { contains: dto.buscar } },
            ],
          }
        : {}),
    };

    // Un asesor solo ve sus conversaciones y las que están sin atender.
    if (user.rolNombre === 'ASESOR') {
      where.AND = [{ OR: [{ asesorId: user.sub }, { asesorId: null }] }];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.conversacionWhatsapp.findMany({
        where,
        orderBy: { ultimaActividad: 'desc' },
        skip,
        take: limit,
        include: {
          cliente: { select: { id: true, nombres: true, apellidos: true, celular: true } },
          asesor: { select: { id: true, nombres: true, apellidos: true } },
          campana: { select: { id: true, nombreCampana: true, plataforma: true } },
          asignaciones: {
            where: { estado: 'PENDIENTE', active: true, deletedAt: null },
            orderBy: { fechaAsignacion: 'desc' },
            take: 1,
            select: { id: true, fechaLimiteRespuesta: true, alertaEscalada: true, estado: true },
          },
          _count: { select: { mensajes: true } },
        },
      }),
      this.prisma.conversacionWhatsapp.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async findOneConversacion(empresaId: string, user: JwtPayload, id: string) {
    const conversacion: any = await this.prisma.conversacionWhatsapp.findFirst({
      where: {
        id,
        empresaId,
        active: true,
        deletedAt: null,
        ...(user.rolNombre === 'ASESOR' ? { OR: [{ asesorId: user.sub }, { asesorId: null }] } : {}),
      },
      include: {
        cliente: { select: { id: true, nombres: true, apellidos: true, celular: true, correo: true } },
        asesor: { select: { id: true, nombres: true, apellidos: true } },
        campana: { select: { id: true, nombreCampana: true, plataforma: true } },
        calificacion: true,
        asignaciones: {
          orderBy: { fechaAsignacion: 'desc' },
          include: { asesor: { select: { id: true, nombres: true, apellidos: true } } },
        },
      },
    });
    if (!conversacion) throw new NotFoundException('Conversación no encontrada.');

    const mensajes = await this.decorarMensajes(
      await this.prisma.mensajeWhatsapp.findMany({
        where: { conversacionId: id, active: true, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      }),
    );

    return { ...conversacion, mensajes };
  }

  private async decorarMensajes(mensajes: any[]) {
    const conMedia = mensajes.filter((m) => m.mediaStoragePath);
    if (!conMedia.length || !this.storage.configurado) return mensajes;

    const urls = new Map<string, string | null>();
    for (const m of conMedia) {
      urls.set(m.id, await this.storage.crearUrlFirmada(m.mediaStoragePath));
    }
    return mensajes.map((m) => ({ ...m, mediaUrl: urls.get(m.id) ?? null }));
  }

  async enviarMensaje(
    empresaId: string,
    user: JwtPayload,
    conversacionId: string,
    dto: EnviarMensajeDto,
  ) {
    const empresa: any = await this.prisma.empresa.findFirst({
      where: { id: empresaId },
      select: { id: true, nombre: true, waPhoneNumberId: true, waActivo: true },
    });
    if (!empresa) throw new NotFoundException('Empresa no encontrada.');

    const conversacion: any = await this.prisma.conversacionWhatsapp.findFirst({
      where: {
        id: conversacionId,
        empresaId,
        active: true,
        deletedAt: null,
        ...(user.rolNombre === 'ASESOR' ? { OR: [{ asesorId: user.sub }, { asesorId: null }] } : {}),
      },
    });
    if (!conversacion) throw new NotFoundException('Conversación no encontrada.');

    const mensaje: any = await this.enviarYRegistrar(
      empresa,
      conversacion,
      conversacion.waContactPhone,
      dto.contenido,
      'ASESOR',
      user.sub,
    );

    const data: any = { ultimaActividad: new Date() };
    if (conversacion.estado === 'PENDIENTE_ASESOR') {
      data.estado = 'ATENCION_HUMANA';
      data.fechaTransferencia = conversacion.fechaTransferencia ?? new Date();
    }
    if (!conversacion.asesorId) data.asesorId = user.sub;

    await this.prisma.conversacionWhatsapp.update({ where: { id: conversacion.id }, data });

    const asignacionPendiente: any = await this.prisma.asignacionConversacion.findFirst({
      where: { conversacionId: conversacion.id, asesorId: user.sub, estado: 'PENDIENTE', active: true, deletedAt: null },
      orderBy: { fechaAsignacion: 'desc' },
    });
    if (asignacionPendiente) {
      await this.prisma.asignacionConversacion.update({
        where: { id: asignacionPendiente.id },
        data: { estado: 'ATENDIDA', fechaPrimeraRespuesta: asignacionPendiente.fechaPrimeraRespuesta ?? new Date() },
      });
    }

    return mensaje;
  }

  async cambiarModo(empresaId: string, user: JwtPayload, conversacionId: string, dto: CambiarModoDto) {
    await this.validarConversacionAccesible(empresaId, user, conversacionId);
    return this.prisma.conversacionWhatsapp.update({
      where: { id: conversacionId },
      data: {
        modoAtencion: dto.modoAtencion,
        iaActiva: dto.iaActiva ?? dto.modoAtencion === 'IA',
        ...(dto.modoAtencion === 'HUMANA' && user.rolNombre === 'ASESOR' ? { asesorId: user.sub } : {}),
      },
    });
  }

  async cambiarEstado(empresaId: string, user: JwtPayload, conversacionId: string, estado: string) {
    await this.validarConversacionAccesible(empresaId, user, conversacionId);
    return this.prisma.conversacionWhatsapp.update({
      where: { id: conversacionId },
      data: {
        estado: estado as any,
        ...(estado === 'CERRADA' ? { fechaCierre: new Date(), iaActiva: false, modoAtencion: 'HUMANA' } : {}),
      },
    });
  }

  async asignarConversacion(
    empresaId: string,
    user: JwtPayload,
    conversacionId: string,
    dto: AsignarConversacionDto,
  ) {
    const conversacion: any = await this.validarConversacionAccesible(empresaId, user, conversacionId);
    const empresa: any = await this.prisma.empresa.findFirst({
      where: { id: empresaId },
      select: { id: true, nombre: true, waPhoneNumberId: true, waActivo: true },
    });

    return this.transferirAAsesor(
      empresa,
      conversacion,
      dto.motivo ?? 'Asignación manual desde la bandeja.',
      conversacion.resumenComercial ?? null,
      dto.asesorId ?? null,
    );
  }

  private async validarConversacionAccesible(empresaId: string, user: JwtPayload, id: string) {
    const conversacion: any = await this.prisma.conversacionWhatsapp.findFirst({
      where: {
        id,
        empresaId,
        active: true,
        deletedAt: null,
        ...(user.rolNombre === 'ASESOR' ? { OR: [{ asesorId: user.sub }, { asesorId: null }] } : {}),
      },
    });
    if (!conversacion) throw new NotFoundException('Conversación no encontrada.');
    return conversacion;
  }

  async metricas(empresaId: string) {
    const desde = new Date();
    desde.setDate(desde.getDate() - 30);

    const [porEstado, total, pendientesIa, sinRespuesta, mensajesPorDireccion] = await Promise.all([
      this.prisma.conversacionWhatsapp.groupBy({
        by: ['estado'],
        where: { empresaId, active: true, deletedAt: null },
        _count: { _all: true },
      }).catch(() => [] as any[]),
      this.prisma.conversacionWhatsapp.count({ where: { empresaId, active: true, deletedAt: null } }),
      this.prisma.conversacionWhatsapp.count({
        where: { empresaId, active: true, deletedAt: null, modoAtencion: 'IA' },
      }),
      this.prisma.asignacionConversacion.count({
        where: { empresaId, alertaEscalada: true, active: true, deletedAt: null },
      }),
      this.prisma.mensajeWhatsapp.groupBy({
        by: ['direccion'],
        where: { empresaId, active: true, deletedAt: null, createdAt: { gte: desde } },
        _count: { _all: true },
      }).catch(() => [] as any[]),
    ]);

    const asesoresCarga = await this.cargaPorAsesor(empresaId);

    return {
      totalConversaciones: total,
      enAtencionIa: pendientesIa,
      escaladasSinRespuesta: sinRespuesta,
      porEstado: this.normalizarConteo(porEstado, 'estado'),
      porDireccion: this.normalizarConteo(mensajesPorDireccion, 'direccion'),
      cargaPorAsesor: asesoresCarga,
    };
  }

  /**
   * Prisma v7 tiene un bug con `groupBy` cuando se agrupa por claves foráneas escalares
   * (devuelve 0 filas). Por eso la carga por asesor se calcula con `count()` directo.
   */
  private async cargaPorAsesor(empresaId: string) {
    const asesores: any[] = await this.prisma.usuario.findMany({
      where: { empresaId, active: true, deletedAt: null },
      select: { id: true, nombres: true, apellidos: true, rol: { select: { nombre: true } } },
    });

    const resultado = [];
    for (const a of asesores) {
      const [pendientes, atendidas] = await Promise.all([
        this.prisma.asignacionConversacion.count({
          where: { asesorId: a.id, estado: 'PENDIENTE', active: true, deletedAt: null },
        }),
        this.prisma.asignacionConversacion.count({
          where: { asesorId: a.id, estado: 'ATENDIDA', active: true, deletedAt: null },
        }),
      ]);
      resultado.push({
        asesorId: a.id,
        nombre: `${a.nombres} ${a.apellidos}`,
        rol: a.rol?.nombre ?? null,
        pendientes,
        atendidas,
      });
    }
    return resultado.sort((x, y) => y.pendientes - x.pendientes);
  }

  private normalizarConteo(filas: any[], clave: string) {
    const out: Record<string, number> = {};
    (filas ?? []).forEach((f) => {
      out[String(f?.[clave])] = Number(f?._count?._all ?? 0);
    });
    return out;
  }

  // ===================================================================
  // Solicitudes de visita
  // ===================================================================

  async crearSolicitudVisita(
    empresaId: string,
    user: JwtPayload,
    conversacionId: string,
    dto: CrearSolicitudVisitaDesdeConversacionDto,
  ) {
    const conversacion: any = await this.validarConversacionAccesible(empresaId, user, conversacionId);

    const solicitud = await this.prisma.solicitudVisita.create({
      data: {
        empresaId,
        conversacionId: conversacion.id,
        clienteId: conversacion.clienteId ?? null,
        propiedadId: dto.propiedadId ?? null,
        proyectoId: dto.proyectoId ?? null,
        asesorId: dto.asesorId ?? conversacion.asesorId ?? null,
        fechaSolicitada: dto.fechaSolicitada ? new Date(dto.fechaSolicitada) : null,
        preferenciaHorario: dto.preferenciaHorario ?? null,
        observaciones: dto.observaciones ?? null,
        estado: 'PENDIENTE',
      },
    });

    if (solicitud.asesorId) {
      await this.notificar(
        empresaId,
        solicitud.asesorId,
        'SOLICITUD_VISITA',
        `Nueva solicitud de visita: ${conversacion.waContactName ?? conversacion.waContactPhone}`,
        dto.preferenciaHorario ? `Preferencia: ${dto.preferenciaHorario}` : null,
        solicitud.id,
        'SolicitudVisita',
      );
    }

    return solicitud;
  }

  async findAllSolicitudesVisita(empresaId: string, user: JwtPayload, estado?: string) {
    return this.prisma.solicitudVisita.findMany({
      where: {
        empresaId,
        active: true,
        deletedAt: null,
        ...(estado ? { estado: estado as any } : {}),
        ...(user.rolNombre === 'ASESOR' ? { OR: [{ asesorId: user.sub }, { asesorId: null }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        cliente: { select: { id: true, nombres: true, apellidos: true, celular: true } },
        propiedad: { select: { id: true, nombre: true, codigoInterno: true } },
        proyecto: { select: { id: true, nombre: true } },
        asesor: { select: { id: true, nombres: true, apellidos: true } },
      },
    });
  }

  /** Confirma una solicitud de visita creando la `VisitaPropiedad` correspondiente. */
  async confirmarSolicitudVisita(
    empresaId: string,
    user: JwtPayload,
    solicitudId: string,
    dto: ConfirmarSolicitudVisitaDto,
  ) {
    const solicitud: any = await this.prisma.solicitudVisita.findFirst({
      where: { id: solicitudId, empresaId, active: true, deletedAt: null },
    });
    if (!solicitud) throw new NotFoundException('Solicitud de visita no encontrada.');

    const propiedadId = dto.propiedadId ?? solicitud.propiedadId;
    const asesorId = dto.asesorId ?? solicitud.asesorId ?? (user.rolNombre === 'ASESOR' ? user.sub : null);
    const clienteId = solicitud.clienteId;

    if (!propiedadId || !asesorId || !clienteId) {
      throw new NotFoundException(
        'La solicitud requiere cliente, propiedad y asesor para confirmarse. Complete esos datos primero.',
      );
    }

    const visita = await this.prisma.visitaPropiedad.create({
      data: {
        empresaId,
        clienteId,
        asesorId,
        propiedadId,
        fechaHora: new Date(dto.fechaHora),
        duracionEstimada: dto.duracionEstimada ?? null,
        lugarEncuentro: dto.lugarEncuentro ?? null,
        estado: 'CONFIRMADA',
        solicitudVisitaId: solicitud.id,
        conversacionId: solicitud.conversacionId ?? null,
      },
    });

    await this.prisma.solicitudVisita.update({
      where: { id: solicitud.id },
      data: { estado: 'CONVERTIDA' },
    });

    return visita;
  }

  private async notificar(
    empresaId: string,
    asesorId: string,
    tipo: string,
    titulo: string,
    mensaje: string | null,
    entidadId: string,
    entidadTipo: string,
  ) {
    const ahora = new Date();
    return this.prisma.notificacion.upsert({
      where: {
        empresaId_asesorId_tipo_entidadId: {
          empresaId,
          asesorId,
          tipo: tipo as any,
          entidadId,
        },
      },
      create: {
        empresaId,
        asesorId,
        tipo: tipo as any,
        titulo,
        mensaje,
        entidadId,
        entidadTipo,
        fechaNotificacion: ahora,
      },
      update: { titulo, mensaje, leida: false, fechaNotificacion: ahora, active: true, deletedAt: null },
    });
  }

  // ===================================================================
  // Utilidad expuesta para probar la conexión con Meta
  // ===================================================================

  async estadoIntegracion(empresaId: string) {
    const empresa: any = await this.prisma.empresa.findFirst({
      where: { id: empresaId },
      select: {
        id: true,
        nombre: true,
        waPhoneNumberId: true,
        waWabaId: true,
        waNumero: true,
        waActivo: true,
      },
    });

    const [conversaciones, mensajes] = await Promise.all([
      this.prisma.conversacionWhatsapp.count({ where: { empresaId, active: true, deletedAt: null } }),
      this.prisma.mensajeWhatsapp.count({ where: { empresaId, active: true, deletedAt: null } }),
    ]);

    return {
      empresa,
      iaConfigurada: this.groq.configurado,
      almacenamientoConfigurado: this.storage.configurado,
      conversaciones,
      mensajes,
    };
  }
}
