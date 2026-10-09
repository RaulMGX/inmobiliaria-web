import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FindNotificacionesQueryDto, MarcarLeidaDto } from './dto/notificaciones.query.dto';
import { NotificacionesService } from './notificaciones.service';

@ApiTags('Notificaciones')
@Controller('empresas/:empresaId/notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Post('sincronizar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Generar/actualizar notificaciones desde Seguimientos (PENDIENTE/EN_PROCESO), Visitas próximas (2 días) y Reservas por vencer (3 días)',
  })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Notificaciones sincronizadas.' })
  sincronizar(
    @Param('empresaId') empresaId: string,
    @Query('asesorId') asesorId?: string,
  ) {
    return this.notificacionesService.sincronizar(empresaId, asesorId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar notificaciones paginadas (filtros: asesor, tipo, leída)' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Listado paginado de notificaciones.' })
  findAll(
    @Param('empresaId') empresaId: string,
    @Query() query: FindNotificacionesQueryDto,
    @Query('leida') rawLeida?: string,
  ) {
    // Bypass: GlobalValidationPipe + @IsBoolean() puede strippear el valor string
    // "false"/"true" del query (whitelist:true + validación rechaza string). Sobreescribimos con el raw.
    if (rawLeida !== undefined) (query as any).leida = rawLeida;
    return this.notificacionesService.findAll(empresaId, query);
  }

  @Get('pendientes/contador')
  @ApiOperation({ summary: 'Contador de notificaciones no leídas, desglosado por tipo' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Contador pendientes.' })
  contarPendientes(
    @Param('empresaId') empresaId: string,
    @Query('asesorId') asesorId?: string,
  ) {
    return this.notificacionesService.contarPendientes(empresaId, asesorId);
  }

  @Patch(':id/leida')
  @ApiOperation({ summary: 'Marcar notificación como leída / no leída' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123notif' })
  @ApiOkResponse({ description: 'Estado de lectura actualizado.' })
  marcarLeida(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @Body() dto: MarcarLeidaDto,
  ) {
    return this.notificacionesService.marcarLeida(empresaId, id, dto.leida);
  }

  @Patch('marcar-todas-leidas')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar todas las notificaciones pendientes como leídas (de la empresa o de un asesor)' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiCreatedResponse({ description: 'Todas las notificaciones pendientes marcadas leídas.' })
  marcarTodasLeidas(
    @Param('empresaId') empresaId: string,
    @Query('asesorId') asesorId?: string,
  ) {
    return this.notificacionesService.marcarTodasLeidas(empresaId, asesorId);
  }
}
