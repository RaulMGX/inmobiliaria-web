import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type { ReporteQueryDto } from './dto/reporte.query.dto';

function parseRange(q: ReporteQueryDto) {
  const now = new Date();
  const from = q.from ? new Date(q.from) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = q.to ? new Date(q.to) : now;
  return { from, to };
}

function d2s(v: { toString(): string } | null | undefined) {
  return v ? v.toString() : '0';
}

function groupByField<T extends Record<string, any>>(
  rows: T[],
  key: keyof T,
  valueKey: keyof T = '_all' as any,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = String(r[key]);
    const agg = (r as any)._count;
    out[k] = agg ? (agg[valueKey] ?? 0) : 0;
  }
  return out;
}

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  async ventas(empresaId: string, q: ReporteQueryDto) {
    const { from, to } = parseRange(q);
    const base = { empresaId, active: true, deletedAt: null as null };
    const where = {
      ...base,
      fechaVenta: { gte: from, lte: to },
      ...(q.asesorId ? { asesorId: q.asesorId } : {}),
      ...(q.clienteId ? { clienteId: q.clienteId } : {}),
      ...(q.propiedadId ? { propiedadId: q.propiedadId } : {}),
    };

    const includeVenta = {
      cliente: { select: { id: true, nombres: true, apellidos: true, numeroDocumento: true, correo: true, celular: true } },
      propiedad: {
        select: {
          id: true, codigoInterno: true, nombre: true, estado: true,
          proyecto: { select: { id: true, nombre: true } },
        },
      },
      asesor: { select: { id: true, nombres: true, apellidos: true, correo: true } },
    };

    const [rows, agg, porEstadoRows] = await Promise.all([
      this.prisma.venta.findMany({
        where, orderBy: { fechaVenta: 'desc' }, take: q.limit ?? 100,
        include: includeVenta,
      }),
      this.prisma.venta.aggregate({
        where,
        _count: { _all: true },
        _sum: { totalVenta: true, precioFinal: true, saldoPendiente: true },
      }) as any,
      this.prisma.venta.groupBy({ by: ['estado'], where, _count: { _all: true } }),
    ]);

    return {
      filtros: { from: from.toISOString(), to: to.toISOString(), asesorId: q.asesorId ?? null, clienteId: q.clienteId ?? null, propiedadId: q.propiedadId ?? null },
      resumen: {
        cantidad: agg._count._all,
        totalVenta: d2s(agg._sum.totalVenta),
        totalPrecioFinal: d2s(agg._sum.precioFinal),
        totalSaldoPendiente: d2s(agg._sum.saldoPendiente),
        porEstado: groupByField(porEstadoRows as any, 'estado'),
      },
      filas: rows,
    };
  }

  async clientes(empresaId: string, q: ReporteQueryDto) {
    const { from, to } = parseRange(q);
    const base = { empresaId, active: true, deletedAt: null as null };
    const whereCreados = { ...base, createdAt: { gte: from, lte: to } };

    const [todos, nuevos, porEstadoRows, porMedioRows, visitasPorClienteRows, ventasPorClienteRows] = await Promise.all([
      this.prisma.cliente.count({ where: base }),
      this.prisma.cliente.count({ where: whereCreados }),
      this.prisma.cliente.groupBy({ by: ['estado'], where: base, _count: { _all: true } }),
      this.prisma.cliente.groupBy({ by: ['medioCaptacion'], where: base, _count: { _all: true } }),
      this.prisma.visitaPropiedad.groupBy({
        by: ['clienteId'],
        where: { ...base, fechaHora: { gte: from, lte: to } },
        _count: { _all: true },
      }) as any,
      this.prisma.venta.groupBy({
        by: ['clienteId'],
        where: { ...base, fechaVenta: { gte: from, lte: to } },
        _count: { _all: true },
        _sum: { totalVenta: true },
      }) as any,
    ]);

    const rows = await this.prisma.cliente.findMany({
      where: base,
      orderBy: { createdAt: 'desc' },
      take: q.limit ?? 100,
      select: {
        id: true, nombres: true, apellidos: true, tipoDocumento: true, numeroDocumento: true,
        celular: true, correo: true, distrito: true, ciudad: true,
        medioCaptacion: true, estado: true, presupuestoMinimo: true, presupuestoMaximo: true,
        createdAt: true,
      },
    });

    const visitasMap = new Map(visitasPorClienteRows.map((r: any) => [r.clienteId, r._count._all]));
    const ventasMap = new Map(ventasPorClienteRows.map((r: any) => [r.clienteId, r._count._all]));
    const totalVentaMap = new Map(ventasPorClienteRows.map((r: any) => [r.clienteId, d2s(r._sum.totalVenta)]));

    return {
      filtros: { from: from.toISOString(), to: to.toISOString() },
      resumen: {
        totalActivos: todos,
        nuevosEnPeriodo: nuevos,
        porEstado: groupByField(porEstadoRows as any, 'estado'),
        porMedioCaptacion: groupByField(porMedioRows as any, 'medioCaptacion'),
      },
      filas: rows.map((c: any) => ({
        ...c,
        visitasEnPeriodo: visitasMap.get(c.id) ?? 0,
        ventasEnPeriodo: ventasMap.get(c.id) ?? 0,
        totalCompradoEnPeriodo: totalVentaMap.get(c.id) ?? '0',
      })),
    };
  }

  async propiedades(empresaId: string, q: ReporteQueryDto) {
    const { from, to } = parseRange(q);
    const propWhere = { active: true, deletedAt: null as null, proyecto: { empresaId } };
    const ventaWhere = { empresaId, active: true, deletedAt: null as null, fechaVenta: { gte: from, lte: to } };

    const [total, porEstadoRows, porTipoRows, ventasPorPropiedadRows] = await Promise.all([
      this.prisma.propiedad.count({ where: propWhere }),
      this.prisma.propiedad.groupBy({ by: ['estado'], where: propWhere, _count: { _all: true } }),
      this.prisma.propiedad.groupBy({ by: ['tipoPropiedad'], where: propWhere, _count: { _all: true } }),
      this.prisma.venta.groupBy({
        by: ['propiedadId'], where: ventaWhere,
        _count: { _all: true }, _sum: { totalVenta: true },
      }) as any,
    ]);

    const rows = await this.prisma.propiedad.findMany({
      where: propWhere,
      orderBy: { createdAt: 'desc' },
      take: q.limit ?? 100,
      include: {
        proyecto: { select: { id: true, nombre: true, tipoProyecto: true, estado: true } },
      },
    });

    const ventasCount = new Map(ventasPorPropiedadRows.map((r: any) => [r.propiedadId, r._count._all]));
    const ventasSum = new Map(ventasPorPropiedadRows.map((r: any) => [r.propiedadId, d2s(r._sum.totalVenta)]));

    const valorTotalInv = rows.reduce<number>((s, p: any) => s + Number(p.precio), 0);

    return {
      filtros: { from: from.toISOString(), to: to.toISOString() },
      resumen: {
        totalPropiedades: total,
        valorTotalInventario: valorTotalInv.toFixed(2),
        porEstado: groupByField(porEstadoRows as any, 'estado'),
        porTipo: groupByField(porTipoRows as any, 'tipoPropiedad'),
        propiedadesVendidasEnPeriodo: ventasPorPropiedadRows.length,
      },
      filas: rows.map((p: any) => ({
        ...p,
        ventasEnPeriodo: ventasCount.get(p.id) ?? 0,
        montoVendidoEnPeriodo: ventasSum.get(p.id) ?? '0',
      })),
    };
  }

  async visitas(empresaId: string, q: ReporteQueryDto) {
    const { from, to } = parseRange(q);
    const base = { empresaId, active: true, deletedAt: null as null };
    const where = {
      ...base,
      fechaHora: { gte: from, lte: to },
      ...(q.asesorId ? { asesorId: q.asesorId } : {}),
      ...(q.clienteId ? { clienteId: q.clienteId } : {}),
      ...(q.propiedadId ? { propiedadId: q.propiedadId } : {}),
    };

    const [count, porEstadoRows, porAsesorRows, rows] = await Promise.all([
      this.prisma.visitaPropiedad.count({ where }),
      this.prisma.visitaPropiedad.groupBy({ by: ['estado'], where, _count: { _all: true } }),
      this.prisma.visitaPropiedad.groupBy({ by: ['asesorId'], where, _count: { _all: true } }) as any,
      this.prisma.visitaPropiedad.findMany({
        where, orderBy: { fechaHora: 'desc' }, take: q.limit ?? 100,
        include: {
          cliente: { select: { id: true, nombres: true, apellidos: true, celular: true } },
          propiedad: { select: { id: true, codigoInterno: true, nombre: true } },
          asesor: { select: { id: true, nombres: true, apellidos: true } },
        },
      }),
    ]);

    const realizadas = (groupByField(porEstadoRows as any, 'estado')['REALIZADA'] ?? 0);
    const tasaAsistencia = count ? Math.round((realizadas / count) * 10000) / 100 : 0;

    return {
      filtros: { from: from.toISOString(), to: to.toISOString(), asesorId: q.asesorId ?? null, clienteId: q.clienteId ?? null, propiedadId: q.propiedadId ?? null },
      resumen: {
        total: count,
        realizadas,
        tasaAsistenciaPorcentaje: tasaAsistencia,
        porEstado: groupByField(porEstadoRows as any, 'estado'),
        cantidadAsesoresConVisita: porAsesorRows.length,
      },
      filas: rows,
    };
  }

  async reservas(empresaId: string, q: ReporteQueryDto) {
    const { from, to } = parseRange(q);
    const base = { empresaId, active: true, deletedAt: null as null };
    const where = {
      ...base,
      fechaReserva: { gte: from, lte: to },
      ...(q.asesorId ? { asesorId: q.asesorId } : {}),
      ...(q.clienteId ? { clienteId: q.clienteId } : {}),
      ...(q.propiedadId ? { propiedadId: q.propiedadId } : {}),
    };

    const [agg, porEstadoRows, rows] = await Promise.all([
      this.prisma.reserva.aggregate({
        where,
        _count: { _all: true },
        _sum: { montoSeparacion: true },
      }) as any,
      this.prisma.reserva.groupBy({ by: ['estado'], where, _count: { _all: true } }),
      this.prisma.reserva.findMany({
        where, orderBy: { fechaReserva: 'desc' }, take: q.limit ?? 100,
        include: {
          cliente: { select: { id: true, nombres: true, apellidos: true } },
          propiedad: { select: { id: true, codigoInterno: true, nombre: true } },
          asesor: { select: { id: true, nombres: true, apellidos: true } },
        },
      }),
    ]);

    const convertidas = (groupByField(porEstadoRows as any, 'estado')['CONVERTIDA'] ?? 0);
    const tasaConversion = agg._count._all ? Math.round((convertidas / agg._count._all) * 10000) / 100 : 0;

    return {
      filtros: { from: from.toISOString(), to: to.toISOString(), asesorId: q.asesorId ?? null, clienteId: q.clienteId ?? null, propiedadId: q.propiedadId ?? null },
      resumen: {
        cantidad: agg._count._all,
        totalMontoSeparacion: d2s(agg._sum.montoSeparacion),
        tasaConversionAVentaPorcentaje: tasaConversion,
        porEstado: groupByField(porEstadoRows as any, 'estado'),
      },
      filas: rows,
    };
  }

  async pagos(empresaId: string, q: ReporteQueryDto) {
    const { from, to } = parseRange(q);
    const base = { empresaId, active: true, deletedAt: null as null };
    const where = {
      ...base,
      OR: [
        { fechaPago: { gte: from, lte: to } },
        { fechaVencimiento: { gte: from, lte: to } },
        { createdAt: { gte: from, lte: to } },
      ],
    } as any;

    const [agg, porEstadoRows, porMetodoRows, rows] = await Promise.all([
      this.prisma.pago.aggregate({
        where, _count: { _all: true },
        _sum: { monto: true, saldo: true },
      }) as any,
      this.prisma.pago.groupBy({ by: ['estado'], where, _count: { _all: true } }),
      this.prisma.pago.groupBy({ by: ['metodoPago'], where, _count: { _all: true } }),
      this.prisma.pago.findMany({
        where, orderBy: { createdAt: 'desc' }, take: q.limit ?? 100,
        include: {
          venta: {
            select: {
              id: true, totalVenta: true,
              cliente: { select: { id: true, nombres: true, apellidos: true } },
              propiedad: { select: { id: true, codigoInterno: true, nombre: true } },
            },
          },
          registradoPor: { select: { id: true, nombres: true, apellidos: true } },
        },
      }),
    ]);

    return {
      filtros: { from: from.toISOString(), to: to.toISOString() },
      resumen: {
        cantidad: agg._count._all,
        montoTotal: d2s(agg._sum.monto),
        saldoPendienteTotal: d2s(agg._sum.saldo),
        porEstado: groupByField(porEstadoRows as any, 'estado'),
        porMetodoPago: groupByField(porMetodoRows as any, 'metodoPago'),
      },
      filas: rows,
    };
  }

  async comisiones(empresaId: string, q: ReporteQueryDto) {
    const { from, to } = parseRange(q);
    const base = { empresaId, active: true, deletedAt: null as null };
    const where = {
      ...base,
      fechaGeneracion: { gte: from, lte: to },
      ...(q.asesorId ? { asesorId: q.asesorId } : {}),
    };

    const [agg, porEstadoRows, porAsesorRows, rows] = await Promise.all([
      this.prisma.comision.aggregate({
        where, _count: { _all: true },
        _sum: { montoComision: true },
      }) as any,
      this.prisma.comision.groupBy({ by: ['estado'], where, _count: { _all: true } }),
      this.prisma.comision.groupBy({
        by: ['asesorId'], where,
        _count: { _all: true }, _sum: { montoComision: true },
      }) as any,
      this.prisma.comision.findMany({
        where, orderBy: { fechaGeneracion: 'desc' }, take: q.limit ?? 100,
        include: {
          asesor: { select: { id: true, nombres: true, apellidos: true, correo: true } },
          venta: {
            select: {
              id: true, totalVenta: true, fechaVenta: true,
              cliente: { select: { id: true, nombres: true, apellidos: true } },
              propiedad: { select: { id: true, codigoInterno: true, nombre: true } },
            },
          },
        },
      }),
    ]);

    const asesorIds = porAsesorRows.map((r: any) => r.asesorId);
    const asesores = asesorIds.length
      ? await this.prisma.usuario.findMany({ where: { id: { in: asesorIds }, empresaId }, select: { id: true, nombres: true, apellidos: true } })
      : [];
    const aMap = new Map(asesores.map((a) => [a.id, a]));

    return {
      filtros: { from: from.toISOString(), to: to.toISOString(), asesorId: q.asesorId ?? null },
      resumen: {
        cantidad: agg._count._all,
        montoTotal: d2s(agg._sum.montoComision),
        porEstado: groupByField(porEstadoRows as any, 'estado'),
        porAsesor: porAsesorRows.map((r: any) => ({
          asesorId: r.asesorId,
          nombres: aMap.get(r.asesorId)?.nombres ?? null,
          apellidos: aMap.get(r.asesorId)?.apellidos ?? null,
          cantidad: r._count._all,
          monto: d2s(r._sum.montoComision),
        })),
      },
      filas: rows,
    };
  }

  async rendimientoAsesores(empresaId: string, q: ReporteQueryDto) {
    const { from, to } = parseRange(q);
    const base = { empresaId, active: true, deletedAt: null as null };

    const [
      ventasPorAsesorRows,
      visitasPorAsesorRows,
      reservasPorAsesorRows,
      comisionesPorAsesorRows,
      pipelinePorAsesorRows,
      todosAsesores,
    ] = await Promise.all([
      this.prisma.venta.groupBy({
        by: ['asesorId'],
        where: { ...base, fechaVenta: { gte: from, lte: to } },
        _count: { _all: true }, _sum: { totalVenta: true },
      }) as any,
      this.prisma.visitaPropiedad.groupBy({
        by: ['asesorId'],
        where: { ...base, fechaHora: { gte: from, lte: to } },
        _count: { _all: true },
      }) as any,
      this.prisma.reserva.groupBy({
        by: ['asesorId'],
        where: { ...base, fechaReserva: { gte: from, lte: to } },
        _count: { _all: true },
      }) as any,
      this.prisma.comision.groupBy({
        by: ['asesorId'],
        where: { ...base, fechaGeneracion: { gte: from, lte: to } },
        _count: { _all: true }, _sum: { montoComision: true },
      }) as any,
      this.prisma.pipelineComercial.groupBy({
        by: ['asesorId'],
        where: { ...base, fechaIngreso: { gte: from, lte: to } },
        _count: { _all: true },
      }) as any,
      this.prisma.usuario.findMany({
        where: { empresaId, active: true, deletedAt: null },
        select: { id: true, nombres: true, apellidos: true, correo: true, telefono: true, rolId: true },
      }),
    ]);

    const ventas = new Map(ventasPorAsesorRows.map((r: any) => [r.asesorId, r]));
    const visitas = new Map(visitasPorAsesorRows.map((r: any) => [r.asesorId, r._count._all]));
    const reservas = new Map(reservasPorAsesorRows.map((r: any) => [r.asesorId, r._count._all]));
    const comisiones = new Map(comisionesPorAsesorRows.map((r: any) => [r.asesorId, r]));
    const pipelines = new Map(pipelinePorAsesorRows.map((r: any) => [r.asesorId, r._count._all]));

    const filas = todosAsesores
      .map((a) => {
        const v = ventas.get(a.id) as any;
        const c = comisiones.get(a.id) as any;
        const ventasCant = v?._count?._all ?? 0;
        const totalVendido = v?._sum?.totalVenta;
        const comisionesCant = c?._count?._all ?? 0;
        const comisionMonto = c?._sum?.montoComision;
        const visitasCant = visitas.get(a.id) ?? 0;
        const reservasCant = reservas.get(a.id) ?? 0;
        const pipelinesCant = pipelines.get(a.id) ?? 0;
        const ticketPromedio = ventasCant ? (Number(totalVendido ?? 0) / ventasCant) : 0;
        const conversionVisitaVenta = visitasCant ? Math.round((ventasCant / (visitasCant as number)) * 10000) / 100 : 0;
        return {
          asesorId: a.id,
          nombres: a.nombres,
          apellidos: a.apellidos,
          correo: a.correo,
          telefono: a.telefono,
          pipelinesNuevos: pipelinesCant,
          visitasRealizadas: visitasCant,
          reservasHechas: reservasCant,
          ventasCerradas: ventasCant,
          totalVendido: d2s(totalVendido),
          ticketPromedio: ticketPromedio.toFixed(2),
          comisionesCantidad: comisionesCant,
          comisionesMonto: d2s(comisionMonto),
          tasaConversionVisitaVentaPorcentaje: conversionVisitaVenta,
        };
      })
      .sort((a, b) => Number(b.totalVendido) - Number(a.totalVendido))
      .slice(0, q.limit ?? 100);

    const totalVendidoGlobal = filas.reduce((s, f) => s + Number(f.totalVendido), 0);
    const totalVentas = filas.reduce((s, f) => s + Number(f.ventasCerradas), 0);
    const totalVisitas = filas.reduce((s, f) => s + Number(f.visitasRealizadas), 0);
    const totalComisiones = filas.reduce((s, f) => s + Number(f.comisionesMonto), 0);

    return {
      filtros: { from: from.toISOString(), to: to.toISOString() },
      resumen: {
        cantidadAsesores: filas.length,
        totalVentasCerradas: totalVentas,
        totalVendido: totalVendidoGlobal.toFixed(2),
        totalVisitas: totalVisitas,
        ticketPromedioGlobal: totalVentas ? (totalVendidoGlobal / totalVentas).toFixed(2) : '0',
        totalComisiones: totalComisiones.toFixed(2),
      },
      filas,
    };
  }
}
