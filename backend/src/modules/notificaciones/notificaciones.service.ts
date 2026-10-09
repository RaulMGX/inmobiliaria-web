import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type { FindNotificacionesQueryDto } from './dto/notificaciones.query.dto';

const DIAS_VISITA_PROXIMA = 2;
const DIAS_RESERVA_VENCE = 3;

function addDays(d: Date, days: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

@Injectable()
export class NotificacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async sincronizar(empresaId: string, asesorId?: string) {
    const now = new Date();
    const hastaVisita = addDays(now, DIAS_VISITA_PROXIMA);
    const hastaReserva = addDays(now, DIAS_RESERVA_VENCE);

    const whereSeguimiento = {
      empresaId, active: true, deletedAt: null as null,
      estado: { in: ['PENDIENTE', 'EN_PROCESO'] },
      ...(asesorId ? { asesorId } : {}),
    } as const;
    const whereVisita = {
      empresaId, active: true, deletedAt: null as null,
      estado: { in: ['PROGRAMADA', 'CONFIRMADA', 'REPROGRAMADA'] },
      fechaHora: { gte: now, lte: hastaVisita },
      ...(asesorId ? { asesorId } : {}),
    } as const;
    const whereReserva = {
      empresaId, active: true, deletedAt: null as null,
      estado: 'ACTIVA',
      fechaVencimiento: { gte: now, lte: hastaReserva },
      ...(asesorId ? { asesorId } : {}),
    } as const;

    const [seguimientos, visitas, reservas] = await Promise.all([
      this.prisma.seguimientoAgenda.findMany({
        where: whereSeguimiento as any,
        select: { id: true, asesorId: true, fechaProgramada: true, tipo: true, prioridad: true, observaciones: true,
          cliente: { select: { id: true, nombres: true, apellidos: true } } },
      }) as unknown as any[],
      this.prisma.visitaPropiedad.findMany({
        where: whereVisita as any,
        select: { id: true, asesorId: true, fechaHora: true, estado: true, lugarEncuentro: true,
          cliente: { select: { id: true, nombres: true, apellidos: true } },
          propiedad: { select: { id: true, codigoInterno: true, nombre: true } } },
      }) as unknown as any[],
      this.prisma.reserva.findMany({
        where: whereReserva as any,
        select: { id: true, asesorId: true, fechaVencimiento: true, montoSeparacion: true,
          cliente: { select: { id: true, nombres: true, apellidos: true } },
          propiedad: { select: { id: true, codigoInterno: true, nombre: true } } },
      }) as unknown as any[],
    ]);

    type NData = {
      empresaId: string; asesorId: string; tipo: any;
      titulo: string; mensaje: string | null;
      entidadId: string; entidadTipo: string; fechaNotificacion: Date;
    };
    const payloads: NData[] = [];

    for (const s of seguimientos) {
      payloads.push({
        empresaId, asesorId: s.asesorId,
        tipo: s.fechaProgramada <= now ? 'SEGUIMIENTO_PENDIENTE' : 'TAREA_PENDIENTE',
        titulo: s.fechaProgramada <= now
          ? `Seguimiento pendiente: ${s.cliente.nombres} ${s.cliente.apellidos}`
          : `Tarea programada: ${s.tipo} con ${s.cliente.nombres} ${s.cliente.apellidos}`,
        mensaje: [s.tipo && `Tipo: ${s.tipo}`, s.prioridad && `Prioridad: ${s.prioridad}`, s.observaciones].filter(Boolean).join(' | ') || null,
        entidadId: s.id, entidadTipo: 'SeguimientoAgenda',
        fechaNotificacion: s.fechaProgramada,
      });
    }

    for (const v of visitas) {
      payloads.push({
        empresaId, asesorId: v.asesorId,
        tipo: 'VISITA_PROXIMA',
        titulo: `Visita próxima: ${v.cliente.nombres} ${v.cliente.apellidos} en ${v.propiedad.nombre}`,
        mensaje: [
          v.estado && `Estado: ${v.estado}`,
          v.lugarEncuentro && `Lugar: ${v.lugarEncuentro}`,
          `Propiedad: ${v.propiedad.codigoInterno}`,
        ].filter(Boolean).join(' | '),
        entidadId: v.id, entidadTipo: 'VisitaPropiedad',
        fechaNotificacion: v.fechaHora,
      });
    }

    for (const r of reservas) {
      payloads.push({
        empresaId, asesorId: r.asesorId,
        tipo: 'RESERVA_POR_VENCER',
        titulo: `Reserva por vencer: ${r.cliente.nombres} ${r.cliente.apellidos} - ${r.propiedad.nombre}`,
        mensaje: `Monto separación: S/ ${r.montoSeparacion.toString()} | Código: ${r.propiedad.codigoInterno}`,
        entidadId: r.id, entidadTipo: 'Reserva',
        fechaNotificacion: r.fechaVencimiento,
      });
    }

    if (payloads.length === 0) return { creadas: 0, actualizadas: 0 };

    const txs = payloads.map((p) =>
      this.prisma.notificacion.upsert({
        where: {
          empresaId_asesorId_tipo_entidadId: {
            empresaId: p.empresaId, asesorId: p.asesorId,
            tipo: p.tipo, entidadId: p.entidadId,
          },
        },
        create: { ...p, active: true },
        update: {
          titulo: p.titulo,
          mensaje: p.mensaje,
          entidadTipo: p.entidadTipo,
          fechaNotificacion: p.fechaNotificacion,
          active: true,
          deletedAt: null,
        },
      }) as any,
    );
    const res = await this.prisma.$transaction(txs);
    return { creadas: res.filter((r: any) => r.createdAt.getTime() === r.updatedAt.getTime()).length, actualizadas: res.length };
  }

  async findAll(empresaId: string, dto: FindNotificacionesQueryDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    // Normalizamos leida manualmente: ValidationPipe puede no tener transform: true,
    // por lo que dto.leida sigue siendo string "false"/"true"/"0"/"1". A prueba de balas.
    const leidaRaw: any = dto.leida;
    let leidaNorm: boolean | undefined;
    if (leidaRaw !== null && leidaRaw !== undefined && leidaRaw !== '' && leidaRaw !== 'null') {
      const s = String(leidaRaw).trim().toLowerCase();
      if (s === 'true' || s === '1') leidaNorm = true;
      else if (s === 'false' || s === '0') leidaNorm = false;
    }

    const where = {
      empresaId,
      active: true,
      deletedAt: null as null,
      ...(dto.asesorId ? { asesorId: dto.asesorId } : {}),
      ...(dto.tipo ? { tipo: dto.tipo as any } : {}),
      ...(leidaNorm !== undefined ? { leida: leidaNorm } : {}),
    } as const;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.notificacion.findMany({
        where, orderBy: [{ leida: 'asc' }, { fechaNotificacion: 'desc' }],
        skip, take: limit,
        include: {
          asesor: { select: { id: true, nombres: true, apellidos: true, correo: true } },
        },
      }),
      this.prisma.notificacion.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async contarPendientes(empresaId: string, asesorId?: string) {
    const where = {
      empresaId, active: true, deletedAt: null as null, leida: false,
      ...(asesorId ? { asesorId } : {}),
    } as const;

    const total = await this.prisma.notificacion.count({ where });

    // BUG PRISMA v7.9.1: `groupBy({ where: { scalar FK } })` retorna 0 filas (empresaId/asesorId son FK scalars).
    // Workaround: query raw con SQL string manual (cuid valores escapados)
    const escape = (v: string) => `'${String(v).replace(/'/g, "''")}'`;
    let sql = `
      SELECT tipo AS tipo, COUNT(*)::bigint AS cnt
      FROM notificaciones
      WHERE active = true AND deleted_at IS NULL AND leida = false AND empresa_id = ${escape(empresaId)}
    `;
    if (asesorId) {
      sql += ` AND asesor_id = ${escape(asesorId)} `;
    }
    sql += ` GROUP BY 1 ORDER BY 2 DESC `;
    let rows: any[] = [];
    try {
      rows = (await (this.prisma as any).$queryRawUnsafe(sql)) as any[];
    } catch (e: any) {
      try {
        // fallback prisma params con array $1, $2
        const params: any[] = [empresaId];
        let pSql = `
          SELECT tipo AS tipo, COUNT(*)::bigint AS cnt
          FROM notificaciones
          WHERE active = true AND deleted_at IS NULL AND leida = false AND empresa_id = $1
        `;
        if (asesorId) {
          params.push(asesorId);
          pSql += ` AND asesor_id = $2 `;
        }
        pSql += ` GROUP BY 1 ORDER BY 2 DESC `;
        rows = (await (this.prisma as any).$queryRawUnsafe(pSql, ...params)) as any[];
      } catch (_e2: any) {
        rows = [];
      }
    }

    const porTipo: Record<string, number> = {};
    (rows || []).forEach((r: any) => {
      porTipo[String(r.tipo)] = Number(r.cnt ?? 0);
    });

    return { totalPendientes: total, porTipo };
  }

  async marcarLeida(empresaId: string, id: string, leida: boolean) {
    const exists = await this.prisma.notificacion.findFirst({
      where: { id, empresaId, active: true, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Notificación no encontrada para la empresa indicada.');

    return this.prisma.notificacion.update({
      where: { id },
      data: { leida, fechaLeida: leida ? new Date() : null },
      include: {
        asesor: { select: { id: true, nombres: true, apellidos: true, correo: true } },
      },
    });
  }

  async marcarTodasLeidas(empresaId: string, asesorId?: string) {
    const where = {
      empresaId, active: true, deletedAt: null as null, leida: false,
      ...(asesorId ? { asesorId } : {}),
    } as const;
    const res = await this.prisma.notificacion.updateMany({
      where,
      data: { leida: true, fechaLeida: new Date() },
    });
    return { marcadas: res.count };
  }
}
