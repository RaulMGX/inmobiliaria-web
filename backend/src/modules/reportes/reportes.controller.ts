import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ReporteQueryDto } from './dto/reporte.query.dto';
import { ReportesService } from './reportes.service';

@ApiTags('Reportes')
@Controller('empresas/:empresaId/reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('ventas')
  @ApiOperation({ summary: 'Reporte de ventas con filtros por periodo, asesor, cliente, propiedad' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Reporte de ventas.' })
  ventas(@Param('empresaId') empresaId: string, @Query() q: ReporteQueryDto) {
    return this.reportesService.ventas(empresaId, q);
  }

  @Get('clientes')
  @ApiOperation({ summary: 'Reporte de clientes: estado, medio de captación, compras y visitas por periodo' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Reporte de clientes.' })
  clientes(@Param('empresaId') empresaId: string, @Query() q: ReporteQueryDto) {
    return this.reportesService.clientes(empresaId, q);
  }

  @Get('propiedades')
  @ApiOperation({ summary: 'Reporte de propiedades: inventario, ventas por propiedad y totales' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Reporte de propiedades.' })
  propiedades(@Param('empresaId') empresaId: string, @Query() q: ReporteQueryDto) {
    return this.reportesService.propiedades(empresaId, q);
  }

  @Get('visitas')
  @ApiOperation({ summary: 'Reporte de visitas programadas: asistencia, por estado y asesor' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Reporte de visitas.' })
  visitas(@Param('empresaId') empresaId: string, @Query() q: ReporteQueryDto) {
    return this.reportesService.visitas(empresaId, q);
  }

  @Get('reservas')
  @ApiOperation({ summary: 'Reporte de reservas: activas, convertidas y tasa de conversión' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Reporte de reservas.' })
  reservas(@Param('empresaId') empresaId: string, @Query() q: ReporteQueryDto) {
    return this.reportesService.reservas(empresaId, q);
  }

  @Get('pagos')
  @ApiOperation({ summary: 'Reporte de pagos: cobrados, pendientes, vencidos y métodos' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Reporte de pagos.' })
  pagos(@Param('empresaId') empresaId: string, @Query() q: ReporteQueryDto) {
    return this.reportesService.pagos(empresaId, q);
  }

  @Get('comisiones')
  @ApiOperation({ summary: 'Reporte de comisiones: por estado, por asesor y totales' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Reporte de comisiones.' })
  comisiones(@Param('empresaId') empresaId: string, @Query() q: ReporteQueryDto) {
    return this.reportesService.comisiones(empresaId, q);
  }

  @Get('rendimiento-asesores')
  @ApiOperation({ summary: 'Rendimiento por asesor: pipelines, visitas, reservas, ventas, ticket promedio y conversión' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Ranking de rendimiento por asesor.' })
  rendimientoAsesores(@Param('empresaId') empresaId: string, @Query() q: ReporteQueryDto) {
    return this.reportesService.rendimientoAsesores(empresaId, q);
  }
}
