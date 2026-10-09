import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import type { KpisOverviewQueryDto } from './dto/kpis-overview.query.dto';

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function decimalToString(value: { toString(): string } | null | undefined) {
  if (!value) return '0';
  return value.toString();
}

function unwrapCount(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') {
    if (typeof v._all === 'number') return v._all;
    const nums = Object.values(v).filter((x) => typeof x === 'number') as Array<number>;
    if (nums.length > 0) return nums[0] ?? 0;
  }
  return 0;
}

function groupCountToRecord(rows: Array<any>, key: string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row[key]] = unwrapCount(row._count);
    return acc;
  }, {});
}

function aggCount(agg: any): number {
  return unwrapCount(agg?._count);
}

function aggSum(agg: any, field: string): any {
  if (!agg || !agg._sum) return null;
  if (typeof agg._sum === 'number') return agg._sum;
  if (agg._sum && typeof agg._sum === 'object') {
    if (field in agg._sum) return agg._sum[field];
    const nums = Object.values(agg._sum).filter((x) => x !== null && x !== undefined);
    if (nums.length === 1) return nums[0];
  }
  return null;
}

function unwrapRowCount(row: any): number {
  return unwrapCount(row?._count);
}

function unwrapRowSum(row: any, field: string): any {
  if (!row) return null;
  if (typeof row[field] !== 'undefined' && row[field] !== null) return row[field];
  if (!row._sum) return null;
  if (typeof row._sum === 'number') return row._sum;
  return row._sum[field] ?? null;
}

@Injectable()
export class KpisService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(empresaId: string, query: KpisOverviewQueryDto) {
    const now = new Date();
    const from = query.from ? new Date(query.from) : startOfMonth(now);
    const to = query.to ? new Date(query.to) : now;
    const topN = query.topAsesores ?? 5;

    const baseWhere = { empresaId, active: true, deletedAt: null as null };
    const propiedadWhere = {
      active: true,
      deletedAt: null as null,
      proyecto: { empresaId },
    };

    const [
      clientesTotal,
      clientesNuevos,
      clientesPendientesCount,
      propiedadesTotal,
      propiedadesPorEstadoRows,
      pipelinePorEtapaRows,
      visitasProgramadasCount,
      visitasPorEstadoRows,
      reservasActivasCount,
      reservasPorEstadoRows,
      ventasMesAgg,
      ventasPagadasCount,
      totalVendidoAgg,
      ventasPorEstadoRows,
      topAsesoresRows,
      pagosCobradoAgg,
      pagosPendientesCount,
      pagosVencidosCount,
      saldoPendienteAgg,
      comisionesPendientesAgg,
      comisionesPagadasAgg,
    ] = await Promise.all([
      this.prisma.cliente.count({ where: baseWhere }),
      this.prisma.cliente.count({
        where: { ...baseWhere, createdAt: { gte: from, lte: to } },
      }),
      this.prisma.cliente.count({
        where: { ...baseWhere, estado: { not: 'CLIENTE' } },
      }),
      this.prisma.propiedad.count({ where: propiedadWhere }),
      (this.prisma as any).$queryRawUnsafe(
        `SELECT p.estado AS estado, COUNT(*)::int AS _count
         FROM propiedades p INNER JOIN proyectos pr ON pr.id = p.proyecto_id
         WHERE pr.empresa_id = $1 AND p.active = true AND p.deleted_at IS NULL GROUP BY p.estado`,
        empresaId,
      ),
      (this.prisma as any).$queryRawUnsafe(
        `SELECT etapa, COUNT(*)::int AS _count FROM pipelines_comerciales
         WHERE empresa_id = $1 AND active = true AND deleted_at IS NULL GROUP BY etapa`,
        empresaId,
      ),
      this.prisma.visitaPropiedad.count({
        where: {
          ...baseWhere,
          estado: { in: ['PROGRAMADA', 'CONFIRMADA', 'REPROGRAMADA'] },
        },
      }),
      (this.prisma as any).$queryRawUnsafe(
        `SELECT estado, COUNT(*)::int AS _count FROM visitas_propiedades
         WHERE empresa_id = $1 AND active = true AND deleted_at IS NULL GROUP BY estado`,
        empresaId,
      ),
      this.prisma.reserva.count({
        where: { ...baseWhere, estado: 'ACTIVA' },
      }),
      (this.prisma as any).$queryRawUnsafe(
        `SELECT estado, COUNT(*)::int AS _count FROM reservas
         WHERE empresa_id = $1 AND active = true AND deleted_at IS NULL GROUP BY estado`,
        empresaId,
      ),
      this.prisma.venta.aggregate({
        where: { ...baseWhere, fechaVenta: { gte: from, lte: to } },
        _count: true,
      }) as any,
      this.prisma.venta.count({
        where: { ...baseWhere, estado: 'PAGADA' },
      }),
      this.prisma.venta.aggregate({
        where: { ...baseWhere },
        _sum: { totalVenta: true },
      }) as any,
      (this.prisma as any).$queryRawUnsafe(
        `SELECT estado, COUNT(*)::int AS _count FROM ventas
         WHERE empresa_id = $1 AND active = true AND deleted_at IS NULL GROUP BY estado`,
        empresaId,
      ),
      (this.prisma as any).$queryRawUnsafe(
        `SELECT asesor_id AS "asesorId", COUNT(*)::int AS _count, COALESCE(SUM(total_venta)::numeric, 0) AS "totalVenta"
         FROM ventas WHERE empresa_id = $1 AND active = true AND deleted_at IS NULL GROUP BY asesor_id`,
        empresaId,
      ),
      this.prisma.pago.aggregate({
        where: { ...baseWhere, estado: 'PAGADO', fechaPago: { gte: from, lte: to } },
        _sum: { monto: true },
        _count: true,
      }) as any,
      this.prisma.pago.count({ where: { ...baseWhere, estado: 'PENDIENTE' } }),
      this.prisma.pago.count({ where: { ...baseWhere, estado: 'VENCIDO' } }),
      this.prisma.pago.aggregate({
        where: { ...baseWhere, estado: { in: ['PENDIENTE', 'VENCIDO'] } },
        _sum: { saldo: true },
      }) as any,
      this.prisma.comision.aggregate({
        where: { ...baseWhere, estado: 'PENDIENTE' as any },
        _sum: { montoComision: true },
        _count: true,
      }) as any,
      this.prisma.comision.aggregate({
        where: { ...baseWhere, estado: 'PAGADA' as any, fechaPago: { gte: from, lte: to } },
        _sum: { montoComision: true },
        _count: true,
      }) as any,
    ]);

    const sortedTopRows = [...(topAsesoresRows as Array<any>)]
      .sort((a: any, b: any) => {
        const ca = unwrapRowCount(a);
        const cb = unwrapRowCount(b);
        if (cb !== ca) return cb - ca;
        const sa = Number(unwrapRowSum(a, 'totalVenta') ?? 0);
        const sb = Number(unwrapRowSum(b, 'totalVenta') ?? 0);
        return sb - sa;
      })
      .slice(0, topN);

    const asesorIds = sortedTopRows.map((r: any) => r.asesorId).filter(Boolean);
    const asesoresData = asesorIds.length
      ? await this.prisma.usuario.findMany({
          where: { id: { in: asesorIds }, empresaId },
          select: { id: true, nombres: true, apellidos: true, correo: true },
        })
      : [];
    const asesorMap = new Map(asesoresData.map((a) => [a.id, a]));

    const topAsesores = sortedTopRows.map((row: any) => {
      const a = row.asesorId ? asesorMap.get(row.asesorId) : undefined;
      return {
        asesorId: row.asesorId ?? null,
        nombres: a?.nombres ?? null,
        apellidos: a?.apellidos ?? null,
        correo: a?.correo ?? null,
        cantidadVentas: unwrapRowCount(row),
        totalVendido: decimalToString(unwrapRowSum(row, 'totalVenta') as any),
      };
    });

    const propiedadesPorEstado = groupCountToRecord(propiedadesPorEstadoRows as any, 'estado');
    const pipelinePorEtapa = groupCountToRecord(pipelinePorEtapaRows as any, 'etapa');
    const visitasPorEstado = groupCountToRecord(visitasPorEstadoRows as any, 'estado');
    const reservasPorEstado = groupCountToRecord(reservasPorEstadoRows as any, 'estado');
    const ventasPorEstado = groupCountToRecord(ventasPorEstadoRows as any, 'estado');

    return {
      periodo: { from: from.toISOString(), to: to.toISOString() },
      clientes: {
        total: clientesTotal,
        nuevos: clientesNuevos,
        pendientes: clientesPendientesCount,
      },
      propiedades: {
        total: propiedadesTotal,
        porEstado: propiedadesPorEstado,
      },
      pipeline: {
        porEtapa: pipelinePorEtapa,
      },
      visitas: {
        programadas: visitasProgramadasCount,
        porEstado: visitasPorEstado,
      },
      reservas: {
        activas: reservasActivasCount,
        porEstado: reservasPorEstado,
      },
      ventas: {
        delMes: aggCount(ventasMesAgg),
        pagadas: ventasPagadasCount,
        totalVendido: decimalToString(aggSum(totalVendidoAgg, 'totalVenta') as any),
        porEstado: ventasPorEstado,
      },
      topAsesores,
      pagos: {
        cantidadPagados: aggCount(pagosCobradoAgg),
        montoCobrado: decimalToString(aggSum(pagosCobradoAgg, 'monto') as any),
        pendientes: pagosPendientesCount,
        vencidos: pagosVencidosCount,
        saldoPendienteTotal: decimalToString(aggSum(saldoPendienteAgg, 'saldo') as any),
      },
      comisiones: {
        cantidadPendientes: aggCount(comisionesPendientesAgg),
        montoPendiente: decimalToString(aggSum(comisionesPendientesAgg, 'montoComision') as any),
        cantidadPagadas: aggCount(comisionesPagadasAgg),
        montoPagado: decimalToString(aggSum(comisionesPagadasAgg, 'montoComision') as any),
      },
    };
  }
}
