import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { requestScopeStore } from '../auth/context/request-scope';
import type { JwtPayload } from '../auth/types/auth.types';
import { GroqService, type AnalisisProspecto } from '../integraciones/groq.service';
import { MetaApiService, type PlantillaMeta } from '../integraciones/meta-api.service';
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
type ArchivoAdjunto = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};
type PropiedadUbicacionIa = {
  referencia?: string;
  id: string;
  nombre: string;
  direccion: string | null;
  distrito: string | null;
  ciudad: string | null;
  latitud: number | null;
  longitud: number | null;
};

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

    // Nombre de campaña: el del referral actual o el ya asociado a la conversación.
    let campanaNombre = campana?.nombreCampana ?? null;
    if (!campanaNombre && conversacion.campanaId) {
      const c = await this.prisma.campana.findFirst({
        where: { id: conversacion.campanaId },
        select: { nombreCampana: true },
      });
      campanaNombre = c?.nombreCampana ?? null;
    }

    await this.responderConIa(empresa, conversacion, telefono, contenido, campanaNombre);
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
      select: { id: true, nombreCampana: true },
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
          id: true,
          nombre: true,
          tipoPropiedad: true,
          estado: true,
          areaTotal: true,
          habitaciones: true,
          banos: true,
          direccion: true,
          distrito: true,
          ciudad: true,
          latitud: true,
          longitud: true,
          proyecto: { select: { nombre: true } },
        },
      }),
    ]);

    const propiedadesDetalle: PropiedadUbicacionIa[] = (propiedades as any[]).map((p, index) => ({
      referencia: `P${index + 1}`,
      id: p.id,
      nombre: p.nombre,
      direccion: p.direccion,
      distrito: p.distrito,
      ciudad: p.ciudad,
      latitud: p.latitud == null ? null : Number(p.latitud),
      longitud: p.longitud == null ? null : Number(p.longitud),
    }));

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
      propiedades: (propiedades as any[]).map((p, index) =>
        [
          `[${propiedadesDetalle[index]?.referencia ?? `P${index + 1}`}] ${p.nombre}`,
          p.tipoPropiedad,
          p.proyecto?.nombre ? `Proyecto: ${p.proyecto.nombre}` : null,
          p.estado,
          p.areaTotal ? `${Number(p.areaTotal)} m²` : null,
          p.habitaciones ? `${p.habitaciones} dorm.` : null,
          p.banos ? `${p.banos} baños` : null,
          [p.direccion, p.distrito, p.ciudad].filter(Boolean).join(', '),
        ]
          .filter(Boolean)
          .join(' | '),
      ),
      propiedadesDetalle,
    };
  }

  private async responderConIa(
    empresa: EmpresaWa,
    conversacion: any,
    telefono: string,
    mensajeActual: string | null,
    campanaNombre: string | null = null,
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
        campanaNombre,
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

    analisis.respuesta = analisis.respuesta
      .replace(/\bP\d+\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    const propiedadSeleccionada = activos.propiedadesDetalle.find(
      (p: PropiedadUbicacionIa) => p.referencia === analisis.propiedadReferencia,
    );
    const calificacionActual = await this.prisma.calificacionProspecto.findUnique({
      where: { conversacionId: conversacion.id },
      select: { propiedadInteresId: true },
    });
    const propiedadPrevia = calificacionActual?.propiedadInteresId
      ? await this.prisma.propiedad.findFirst({
          where: {
            id: calificacionActual.propiedadInteresId,
            active: true,
            deletedAt: null,
          },
          select: {
            id: true,
            nombre: true,
            direccion: true,
            distrito: true,
            ciudad: true,
            latitud: true,
            longitud: true,
          },
        })
      : null;
    const propiedadInteres = propiedadSeleccionada ?? propiedadPrevia;
    await this.guardarCalificacion(empresa, conversacion, analisis, propiedadInteres?.id ?? null);

    if (this.esConsultaUbicacion(mensajeActual)) {
      await this.responderUbicacion(
        empresa,
        conversacion,
        telefono,
        propiedadInteres
          ? {
              ...propiedadInteres,
              latitud: propiedadInteres.latitud == null ? null : Number(propiedadInteres.latitud),
              longitud: propiedadInteres.longitud == null ? null : Number(propiedadInteres.longitud),
            }
          : null,
      );
    } else if (analisis.respuesta) {
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

  private esConsultaUbicacion(mensaje: string | null): boolean {
    return /ubicaci[oó]n|d[oó]nde\s+(?:queda|est[aá]|se\s+ubica)|direcci[oó]n|mapa|c[oó]mo\s+llego/i.test(
      String(mensaje ?? ''),
    );
  }

  private async responderUbicacion(
    empresa: EmpresaWa,
    conversacion: any,
    telefono: string,
    propiedad: PropiedadUbicacionIa | null,
  ) {
    if (!propiedad) {
      await this.enviarYRegistrar(
        empresa,
        conversacion,
        telefono,
        '¿De cuál propiedad o proyecto deseas la ubicación? Dime el nombre o envíame la publicación para compartirte el punto correcto.',
        'IA',
      );
      return;
    }

    const direccion = [propiedad.direccion, propiedad.distrito, propiedad.ciudad]
      .filter(Boolean)
      .join(', ');
    if (propiedad.latitud != null && propiedad.longitud != null) {
      const mapa = `https://www.google.com/maps?q=${propiedad.latitud},${propiedad.longitud}`;
      const nombre = propiedad.nombre || 'la propiedad que te interesa';
      const texto = direccion
        ? `La propiedad ${nombre} está en ${direccion}. Te comparto el punto exacto en el mapa.`
        : `Te comparto la ubicación de ${nombre}.`;
      await this.enviarYRegistrar(empresa, conversacion, telefono, texto, 'IA');
      const pin = await this.enviarUbicacionYRegistrar(
        empresa,
        conversacion,
        telefono,
        propiedad,
        direccion,
        mapa,
      );
      if (pin?.waStatus === 'FALLIDO') {
        await this.enviarYRegistrar(
          empresa,
          conversacion,
          telefono,
          `No pude enviar el pin como ubicación, pero aquí tienes el mapa: ${mapa}`,
          'IA',
        );
      }
      return;
    }

    if (direccion) {
      const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
      await this.enviarYRegistrar(
        empresa,
        conversacion,
        telefono,
        `La propiedad ${propiedad.nombre} está en ${direccion}. Puedes verla en el mapa: ${mapa}`,
        'IA',
      );
      return;
    }

    await this.enviarYRegistrar(
      empresa,
      conversacion,
      telefono,
      `Tengo identificada la propiedad ${propiedad.nombre}, pero aún no tiene una ubicación registrada. Te derivaré con un asesor para confirmar el dato.`,
      'IA',
    );
    await this.transferirAAsesor(
      empresa,
      conversacion,
      'La propiedad de interés no tiene dirección ni coordenadas registradas.',
      'Confirmar ubicación de la propiedad con el cliente.',
    );
  }

  private async enviarUbicacionYRegistrar(
    empresa: EmpresaWa,
    conversacion: any,
    telefono: string,
    propiedad: PropiedadUbicacionIa,
    direccion: string,
    mapa: string,
  ) {
    if (!empresa.waPhoneNumberId) return null;
    const resultado = await this.meta.enviarUbicacion(empresa.waPhoneNumberId, telefono, {
      latitude: propiedad.latitud!,
      longitude: propiedad.longitud!,
      name: propiedad.nombre,
      ...(direccion ? { address: direccion } : {}),
    });
    return this.prisma.mensajeWhatsapp.create({
      data: {
        waMessageId: resultado.messageId ?? null,
        direccion: 'SALIENTE',
        remitenteTipo: 'IA',
        contenido: `${propiedad.nombre}${direccion ? ` | ${direccion}` : ''} | ${mapa}`,
        tipoMensaje: 'UBICACION',
        waStatus: (resultado.ok ? 'ENVIADO' : 'FALLIDO') as any,
        errorCode: resultado.errorCode ?? null,
        errorDetalle: resultado.errorDetalle ?? null,
        empresaId: empresa.id,
        conversacionId: conversacion.id,
      },
    });
  }

  private async guardarCalificacion(
    empresa: EmpresaWa,
    conversacion: any,
    analisis: AnalisisProspecto,
    propiedadInteresId: string | null,
  ) {
    const cal = analisis.calificacion;
    if (!cal && !propiedadInteresId) return;

    const datos = {
      ...(cal
        ? {
            nombresCompletos: cal.nombresCompletos ?? null,
            tipoInmueble: cal.tipoInmueble ?? null,
            ubicacionDeseada: cal.ubicacionDeseada ?? null,
            presupuesto: cal.presupuesto ?? null,
            inicialDisponible: cal.inicialDisponible ?? null,
            intencionCompra: cal.intencionCompra ?? null,
            interesVisita: Boolean(cal.interesVisita),
            dni: cal.dni ?? null,
          }
        : {}),
      ...(propiedadInteresId ? { propiedadInteresId } : {}),
      ...(cal
        ? {
            consentimientoDatos: Boolean(analisis.consentimientoDatos),
            ...(analisis.consentimientoDatos ? { fechaConsentimiento: new Date() } : {}),
            datosJson: cal as any,
          }
        : {}),
    };

    await this.prisma.calificacionProspecto.upsert({
      where: { conversacionId: conversacion.id },
      create: {
        empresaId: empresa.id,
        conversacionId: conversacion.id,
        clienteId: conversacion.clienteId ?? null,
        alcanzaMinimo: Boolean(cal?.presupuesto || cal?.inicialDisponible),
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

  /**
   * Minutos transcurridos desde medianoche en la zona horaria de Perú (UTC-5,
   * sin horario de verano). Se usa para evaluar los turnos de los asesores.
   */
  private minutosActualesLima(): number {
    const lima = new Date(Date.now() - 5 * 60 * 60 * 1000);
    return lima.getUTCHours() * 60 + lima.getUTCMinutes();
  }

  /** Convierte "HH:MM" a minutos desde medianoche. Devuelve null si el formato es inválido. */
  private parseHoraMinutos(valor: string | null | undefined): number | null {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(valor ?? '').trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }

  /**
   * Determina si un asesor está disponible según su turno.
   * Sin horario configurado se considera disponible siempre.
   * Soporta turnos que cruzan la medianoche (ej. 22:00 - 06:00).
   */
  private estaEnTurno(
    asesor: { horaInicioTurno: string | null; horaFinTurno: string | null },
    ahoraMin: number,
  ): boolean {
    const inicio = this.parseHoraMinutos(asesor.horaInicioTurno);
    const fin = this.parseHoraMinutos(asesor.horaFinTurno);
    if (inicio === null || fin === null) return true;
    if (inicio === fin) return true;
    if (inicio < fin) return ahoraMin >= inicio && ahoraMin < fin;
    return ahoraMin >= inicio || ahoraMin < fin;
  }

  /**
   * Elige un asesor priorizando a los que están en turno y, entre ellos, al de
   * menor carga de conversaciones pendientes. Si nadie está en turno, usa a
   * todos los asesores como respaldo.
   */
  private async elegirAsesorConMenorCarga(): Promise<string | null> {
    const asesores: any[] = await this.prisma.usuario.findMany({
      where: { active: true, deletedAt: null, rol: { nombre: 'ASESOR' } },
      select: { id: true, horaInicioTurno: true, horaFinTurno: true },
    });
    if (!asesores.length) return null;

    const ahoraMin = this.minutosActualesLima();
    const enTurno: { id: string; carga: number }[] = [];
    const respaldo: { id: string; carga: number }[] = [];

    for (const a of asesores) {
      const carga = await this.prisma.asignacionConversacion.count({
        where: { asesorId: a.id, estado: 'PENDIENTE', active: true, deletedAt: null },
      });
      (this.estaEnTurno(a, ahoraMin) ? enTurno : respaldo).push({ id: a.id, carga });
    }

    const candidatos = enTurno.length ? enTurno : respaldo;
    candidatos.sort((a, b) => a.carga - b.carga);
    return candidatos[0]?.id ?? null;
  }

  async transferirAAsesor(
    empresa: EmpresaWa,
    conversacion: any,
    motivo: string,
    resumen: string | null,
    asesorIdPreferido?: string | null,
  ) {
    // Regla: si la conversación ya tenía asesor, se conserva (cliente que regresa),
    // aunque no esté en turno. Solo se elige nuevo asesor para conversaciones nuevas.
    const asesorId =
      asesorIdPreferido ?? conversacion.asesorId ?? (await this.elegirAsesorConMenorCarga());
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

    // Un asesor ve sus conversaciones y todas las que necesitan atención humana
    // (PENDIENTE_ASESOR / ATENCION_HUMANA), aunque estén asignadas a otro asesor.
    // Así cualquier asesor puede atender una conversación pendiente.
    if (user.rolNombre === 'ASESOR') {
      where.AND = [
        {
          OR: [
            { asesorId: user.sub },
            { estado: { in: ['PENDIENTE_ASESOR', 'ATENCION_HUMANA'] } },
          ],
        },
      ];
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
        ...(user.rolNombre === 'ASESOR'
          ? { OR: [{ asesorId: user.sub }, { estado: { in: ['PENDIENTE_ASESOR', 'ATENCION_HUMANA'] } }] }
          : {}),
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

  private async registrarRespuestaManual(conversacion: any, user: JwtPayload) {
    const data: any = { ultimaActividad: new Date() };
    if (conversacion.estado === 'PENDIENTE_ASESOR') {
      data.estado = 'ATENCION_HUMANA';
      data.fechaTransferencia = conversacion.fechaTransferencia ?? new Date();
    }
    if (!conversacion.asesorId) data.asesorId = user.sub;
    await this.prisma.conversacionWhatsapp.update({
      where: { id: conversacion.id },
      data,
    });

    const asignacionPendiente: any = await this.prisma.asignacionConversacion.findFirst({
      where: {
        conversacionId: conversacion.id,
        asesorId: user.sub,
        estado: 'PENDIENTE',
        active: true,
        deletedAt: null,
      },
      orderBy: { fechaAsignacion: 'desc' },
    });
    if (asignacionPendiente) {
      await this.prisma.asignacionConversacion.update({
        where: { id: asignacionPendiente.id },
        data: {
          estado: 'ATENDIDA',
          fechaPrimeraRespuesta: asignacionPendiente.fechaPrimeraRespuesta ?? new Date(),
        },
      });
    }
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
        ...(user.rolNombre === 'ASESOR'
          ? { OR: [{ asesorId: user.sub }, { estado: { in: ['PENDIENTE_ASESOR', 'ATENCION_HUMANA'] } }] }
          : {}),
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

    await this.registrarRespuestaManual(conversacion, user);

    return mensaje;
  }

  async enviarMedio(
    empresaId: string,
    user: JwtPayload,
    conversacionId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    captionRaw: string,
  ) {
    if (!['ADMIN', 'ASESOR'].includes(user.rolNombre)) {
      throw new ForbiddenException('Solo un asesor o administrador puede enviar imágenes y videos.');
    }

    const maxImagen = 5 * 1024 * 1024;
    const extensiones: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'video/mp4': 'mp4',
    };
    const extension = extensiones[file.mimetype];
    if (!extension || !file.buffer?.length) {
      throw new BadRequestException('El archivo debe ser una imagen JPG/PNG o un video MP4.');
    }
    const bytes = file.buffer;
    const archivoValido =
      (file.mimetype === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8) ||
      (file.mimetype === 'image/png' &&
        bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
      (file.mimetype === 'video/mp4' &&
        bytes.length >= 12 &&
        bytes.subarray(4, 8).toString('ascii') === 'ftyp');
    if (!archivoValido) {
      throw new BadRequestException('El contenido del archivo no coincide con su tipo de imagen o video.');
    }
    if (file.mimetype.startsWith('image/') && file.size > maxImagen) {
      throw new BadRequestException('Las imágenes no pueden superar 5 MB.');
    }
    if (file.size > 16 * 1024 * 1024) {
      throw new BadRequestException('Los videos no pueden superar 16 MB.');
    }
    const caption = String(captionRaw ?? '').trim();
    if (caption.length > 1024) {
      throw new BadRequestException('El texto de la imagen o video no puede superar 1024 caracteres.');
    }

    const empresa: any = await this.prisma.empresa.findFirst({
      where: { id: empresaId },
      select: { id: true, nombre: true, waPhoneNumberId: true, waActivo: true },
    });
    if (!empresa) throw new NotFoundException('Empresa no encontrada.');
    if (!empresa.waPhoneNumberId || !empresa.waActivo) {
      throw new BadRequestException('La integración de WhatsApp no está activa para esta empresa.');
    }

    const conversacion: any = await this.prisma.conversacionWhatsapp.findFirst({
      where: {
        id: conversacionId,
        empresaId,
        active: true,
        deletedAt: null,
        ...(user.rolNombre === 'ASESOR'
          ? {
              OR: [
                { asesorId: user.sub },
                { estado: { in: ['PENDIENTE_ASESOR', 'ATENCION_HUMANA'] } },
              ],
            }
          : {}),
      },
    });
    if (!conversacion) throw new NotFoundException('Conversación no encontrada.');

    const fileName = `${randomUUID()}.${extension}`;
    const mediaId = await this.meta.subirMedia(
      empresa.waPhoneNumberId,
      file.buffer,
      fileName,
      file.mimetype,
    );
    const tipoMeta = file.mimetype.startsWith('image/') ? 'image' : 'video';
    const resultado = await this.meta.enviarMedia(
      empresa.waPhoneNumberId,
      conversacion.waContactPhone,
      tipoMeta,
      { id: mediaId },
      caption ? { caption } : undefined,
    );

    let mediaStoragePath: string | null = null;
    if (this.storage.configurado) {
      try {
        mediaStoragePath = await this.storage.subirArchivo(
          `empresas/${empresaId}/conversaciones/${conversacionId}`,
          fileName,
          file.buffer,
          file.mimetype,
        );
      } catch (e: any) {
        this.logger.warn(`No se pudo guardar una copia del medio saliente: ${e?.message ?? e}`);
      }
    }

    const mensaje = await this.prisma.mensajeWhatsapp.create({
      data: {
        waMessageId: resultado.messageId ?? null,
        direccion: 'SALIENTE',
        remitenteTipo: 'ASESOR',
        contenido: caption || file.originalname,
        tipoMensaje: tipoMeta === 'image' ? 'IMAGEN' : 'VIDEO',
        mediaId,
        mediaMimeType: file.mimetype,
        mediaStoragePath,
        waStatus: (resultado.ok ? 'ENVIADO' : 'FALLIDO') as any,
        errorCode: resultado.errorCode ?? null,
        errorDetalle: resultado.errorDetalle ?? null,
        empresaId,
        conversacionId,
        remitenteUsuarioId: user.sub,
      },
    });

    await this.registrarRespuestaManual(conversacion, user);

    return {
      ...mensaje,
      mediaUrl: mediaStoragePath ? await this.storage.crearUrlFirmada(mediaStoragePath) : null,
    };
  }

  private validarAccesoPlantillas(user: JwtPayload, soloAdmin = false) {
    const rolesPermitidos = soloAdmin ? ['ADMIN'] : ['ADMIN', 'ASESOR'];
    if (!rolesPermitidos.includes(user.rolNombre)) {
      throw new ForbiddenException(
        soloAdmin
          ? 'Solo un administrador puede crear o administrar plantillas.'
          : 'Solo un asesor o administrador puede usar plantillas.',
      );
    }
  }

  private async obtenerEmpresaPlantillas(empresaId: string): Promise<EmpresaWa> {
    const empresa = await this.prisma.empresa.findFirst({
      where: { id: empresaId, active: true, deletedAt: null },
      select: { id: true, nombre: true, waPhoneNumberId: true, waActivo: true },
    });
    if (!empresa) throw new NotFoundException('Empresa no encontrada.');
    if (!empresa.waActivo || !empresa.waPhoneNumberId) {
      throw new BadRequestException('La integración de WhatsApp no está activa para esta empresa.');
    }
    return empresa;
  }

  private validarArchivoPlantilla(
    file: ArchivoAdjunto,
    headerFormat: 'IMAGE' | 'VIDEO',
  ): string {
    const mimePermitidos =
      headerFormat === 'IMAGE' ? ['image/jpeg', 'image/png'] : ['video/mp4'];
    if (!mimePermitidos.includes(file.mimetype) || !file.buffer?.length) {
      throw new BadRequestException(
        headerFormat === 'IMAGE'
          ? 'Para esta plantilla selecciona una imagen JPG/PNG.'
          : 'Para esta plantilla selecciona un video MP4.',
      );
    }
    const maxBytes = headerFormat === 'IMAGE' ? 5 * 1024 * 1024 : 16 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException(
        headerFormat === 'IMAGE' ? 'La muestra no puede superar 5 MB.' : 'El video no puede superar 16 MB.',
      );
    }
    const bytes = file.buffer;
    const valido =
      (file.mimetype === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8) ||
      (file.mimetype === 'image/png' &&
        bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
      (file.mimetype === 'video/mp4' &&
        bytes.length >= 12 &&
        bytes.subarray(4, 8).toString('ascii') === 'ftyp');
    if (!valido) throw new BadRequestException('El contenido del archivo no coincide con el formato indicado.');
    return file.mimetype === 'image/jpeg' ? 'jpg' : file.mimetype === 'image/png' ? 'png' : 'mp4';
  }

  private contarVariablesPlantilla(body: string): number {
    const tokens = [...body.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)]
      .map((match) => match[1])
      .filter((token): token is string => typeof token === 'string');
    if (!tokens.length) return 0;
    if (tokens.some((token) => !/^\d+$/.test(token))) {
      throw new BadRequestException('El CRM admite variables posicionales {{1}}, {{2}}, etc.');
    }
    const numeros = [...new Set(tokens.map(Number))].sort((a, b) => a - b);
    if (numeros.some((numero, index) => numero !== index + 1)) {
      throw new BadRequestException('Las variables deben estar numeradas consecutivamente desde {{1}}.');
    }
    return numeros.length;
  }

  async listarPlantillas(empresaId: string, user: JwtPayload) {
    this.validarAccesoPlantillas(user);
    await this.obtenerEmpresaPlantillas(empresaId);
    return this.meta.listarPlantillas();
  }

  async crearPlantilla(
    empresaId: string,
    user: JwtPayload,
    input: {
      name: string;
      language: string;
      category: string;
      body: string;
      headerFormat: string;
      bodyExamples: string;
    },
    headerSample?: ArchivoAdjunto,
  ) {
    this.validarAccesoPlantillas(user, true);
    await this.obtenerEmpresaPlantillas(empresaId);

    const name = String(input.name ?? '').trim();
    const language = String(input.language ?? '').trim();
    const category = String(input.category ?? '').toUpperCase();
    const body = String(input.body ?? '').trim();
    const headerFormat = String(input.headerFormat ?? 'NONE').toUpperCase();
    if (!/^[a-z0-9_]{1,512}$/.test(name)) {
      throw new BadRequestException('El nombre debe usar minúsculas, números y guion bajo.');
    }
    if (!/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(language)) {
      throw new BadRequestException('Usa un código de idioma válido, por ejemplo es_PE.');
    }
    if (!['MARKETING', 'UTILITY'].includes(category)) {
      throw new BadRequestException('Selecciona la categoría Marketing o Utilidad.');
    }
    if (!body || body.length > 1024) {
      throw new BadRequestException('El cuerpo de la plantilla debe tener entre 1 y 1024 caracteres.');
    }
    if (!['NONE', 'IMAGE', 'VIDEO'].includes(headerFormat)) {
      throw new BadRequestException('El encabezado debe ser Ninguno, Imagen o Video.');
    }
    const numeroVariables = this.contarVariablesPlantilla(body);
    let bodyExamples: string[] = [];
    if (input.bodyExamples) {
      try {
        const parsed = JSON.parse(input.bodyExamples);
        if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== 'string')) {
          throw new Error('Formato inválido');
        }
        bodyExamples = parsed.map((value) => value.trim());
      } catch {
        throw new BadRequestException('No se pudieron leer los ejemplos de variables.');
      }
    }
    if (bodyExamples.length !== numeroVariables) {
      throw new BadRequestException(
        numeroVariables
          ? `Ingresa un ejemplo para cada variable (se necesitan ${numeroVariables}).`
          : 'No agregues ejemplos si el cuerpo no tiene variables.',
      );
    }

    let headerHandle: string | undefined;
    if (headerFormat === 'NONE' && headerSample) {
      throw new BadRequestException('Quitaste el encabezado, pero aún seleccionaste un archivo de muestra.');
    }
    if (headerFormat !== 'NONE') {
      if (!headerSample) throw new BadRequestException('Selecciona la muestra que Meta revisará.');
      const extension = this.validarArchivoPlantilla(headerSample, headerFormat as 'IMAGE' | 'VIDEO');
      headerHandle = await this.meta.subirMuestraPlantilla(
        `muestra_${name}.${extension}`,
        headerSample.buffer,
        headerSample.mimetype,
      );
    }

    return this.meta.crearPlantilla(
      {
        name,
        language,
        category: category as 'MARKETING' | 'UTILITY',
        body,
        headerFormat: headerFormat as 'NONE' | 'IMAGE' | 'VIDEO',
        bodyExamples,
      },
      headerHandle,
    );
  }

  async enviarPlantillaConversacion(
    empresaId: string,
    user: JwtPayload,
    conversacionId: string,
    input: {
      name: string;
      language: string;
      bodyParams: string;
      consentimientoConfirmado: string | boolean;
    },
    file?: ArchivoAdjunto,
  ) {
    this.validarAccesoPlantillas(user);
    if (input.consentimientoConfirmado !== true && input.consentimientoConfirmado !== 'true') {
      throw new BadRequestException(
        'Confirma que el cliente autorizó recibir este mensaje por WhatsApp.',
      );
    }
    const empresa = await this.obtenerEmpresaPlantillas(empresaId);
    const conversacion: any = await this.prisma.conversacionWhatsapp.findFirst({
      where: {
        id: conversacionId,
        empresaId,
        active: true,
        deletedAt: null,
        ...(user.rolNombre === 'ASESOR'
          ? {
              OR: [
                { asesorId: user.sub },
                { estado: { in: ['PENDIENTE_ASESOR', 'ATENCION_HUMANA'] } },
              ],
            }
          : {}),
      },
    });
    if (!conversacion) throw new NotFoundException('Conversación no encontrada.');

    let bodyParams: string[];
    try {
      const parsed = JSON.parse(input.bodyParams || '[]');
      if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== 'string')) {
        throw new Error('Formato inválido');
      }
      bodyParams = parsed;
    } catch {
      throw new BadRequestException('Revisa los valores de las variables de la plantilla.');
    }

    const plantillas = await this.meta.listarPlantillas();
    const plantilla = plantillas.find(
      (item) => item.name === input.name && item.language === input.language,
    );
    if (!plantilla || plantilla.status !== 'APPROVED') {
      throw new BadRequestException('Solo se pueden enviar plantillas aprobadas por Meta.');
    }
    const bodyComponent = plantilla.components?.find((component) => component.type.toUpperCase() === 'BODY');
    const body = bodyComponent?.text ?? '';
    const numeroVariables = this.contarVariablesPlantilla(body);
    if (bodyParams.length !== numeroVariables) {
      throw new BadRequestException(`Esta plantilla necesita ${numeroVariables} valores para sus variables.`);
    }

    const header = plantilla.components?.find((component) => component.type.toUpperCase() === 'HEADER');
    const headerFormat = header?.format?.toUpperCase() ?? 'NONE';
    let media: { tipo: 'image' | 'video'; id: string } | undefined;
    let mediaStoragePath: string | null = null;
    let mediaMimeType: string | null = null;
    let fileName: string | null = null;

    if (headerFormat === 'IMAGE' || headerFormat === 'VIDEO') {
      if (!file) {
        throw new BadRequestException(
          headerFormat === 'IMAGE'
            ? 'Adjunta la imagen que enviarás en el encabezado de esta plantilla.'
            : 'Adjunta el video que enviarás en el encabezado de esta plantilla.',
        );
      }
      const extension = this.validarArchivoPlantilla(file, headerFormat);
      fileName = `${randomUUID()}.${extension}`;
      mediaMimeType = file.mimetype;
      media = {
        tipo: headerFormat === 'IMAGE' ? 'image' : 'video',
        id: await this.meta.subirMedia(
          empresa.waPhoneNumberId!,
          file.buffer,
          fileName,
          file.mimetype,
        ),
      };
    } else if (file) {
      throw new BadRequestException('Esta plantilla no tiene encabezado de imagen o video.');
    }

    const resultado = await this.meta.enviarPlantilla(
      empresa.waPhoneNumberId!,
      conversacion.waContactPhone,
      plantilla.name,
      plantilla.language,
      bodyParams,
      media,
    );
    if (file && fileName && this.storage.configurado) {
      try {
        mediaStoragePath = await this.storage.subirArchivo(
          `empresas/${empresaId}/conversaciones/${conversacionId}`,
          fileName,
          file.buffer,
          file.mimetype,
        );
      } catch (e: any) {
        this.logger.warn(`No se pudo guardar una copia del medio de plantilla: ${e?.message ?? e}`);
      }
    }
    const contenido = body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_match, numero) => bodyParams[Number(numero) - 1] ?? '');
    const mensaje = await this.prisma.mensajeWhatsapp.create({
      data: {
        waMessageId: resultado.messageId ?? null,
        direccion: 'SALIENTE',
        remitenteTipo: 'ASESOR',
        contenido: contenido || `[Plantilla ${plantilla.name}]`,
        tipoMensaje: media?.tipo === 'image' ? 'IMAGEN' : media?.tipo === 'video' ? 'VIDEO' : 'TEXTO',
        mediaId: media?.id ?? null,
        mediaMimeType,
        mediaStoragePath,
        waStatus: (resultado.ok ? 'ENVIADO' : 'FALLIDO') as any,
        errorCode: resultado.errorCode ?? null,
        errorDetalle: resultado.errorDetalle ?? null,
        empresaId,
        conversacionId,
        remitenteUsuarioId: user.sub,
      },
    });
    await this.registrarRespuestaManual(conversacion, user);
    return {
      ...mensaje,
      mediaUrl: mediaStoragePath ? await this.storage.crearUrlFirmada(mediaStoragePath) : null,
    };
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
        ...(user.rolNombre === 'ASESOR'
          ? { OR: [{ asesorId: user.sub }, { estado: { in: ['PENDIENTE_ASESOR', 'ATENCION_HUMANA'] } }] }
          : {}),
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
