import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/auth.types';
import {
  AsignarConversacionDto,
  CambiarEstadoConversacionDto,
  CambiarModoDto,
  ConfirmarSolicitudVisitaDto,
  CrearSolicitudVisitaDesdeConversacionDto,
  EnviarMensajeDto,
  FindConversacionesQueryDto,
} from './dto/whatsapp.dto';
import { WhatsappService } from './whatsapp.service';

@ApiTags('WhatsApp')
@Controller('empresas/:empresaId/whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('estado')
  @ApiOperation({ summary: 'Estado de la integración de WhatsApp/IA de la empresa' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Configuración y contadores de la integración.' })
  estado(@Param('empresaId') empresaId: string) {
    return this.whatsappService.estadoIntegracion(empresaId);
  }

  @Get('conversaciones')
  @ApiOperation({ summary: 'Listar conversaciones de WhatsApp (bandeja de entrada)' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  findAll(
    @Param('empresaId') empresaId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: FindConversacionesQueryDto,
  ) {
    return this.whatsappService.findAllConversaciones(empresaId, user, query);
  }

  @Get('conversaciones/:id')
  @ApiOperation({ summary: 'Detalle de una conversación con sus mensajes' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123conv' })
  findOne(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.whatsappService.findOneConversacion(empresaId, user, id);
  }

  @Post('conversaciones/:id/mensajes')
  @ApiOperation({ summary: 'Enviar un mensaje manual (asesor) por WhatsApp' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123conv' })
  enviarMensaje(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: EnviarMensajeDto,
  ) {
    return this.whatsappService.enviarMensaje(empresaId, user, id, dto);
  }

  @Patch('conversaciones/:id/modo')
  @ApiOperation({ summary: 'Alternar atención IA / humana de la conversación' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123conv' })
  cambiarModo(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CambiarModoDto,
  ) {
    return this.whatsappService.cambiarModo(empresaId, user, id, dto);
  }

  @Patch('conversaciones/:id/estado')
  @ApiOperation({ summary: 'Cambiar el estado de la conversación' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123conv' })
  cambiarEstado(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CambiarEstadoConversacionDto,
  ) {
    return this.whatsappService.cambiarEstado(empresaId, user, id, dto.estado);
  }

  @Patch('conversaciones/:id/asignar')
  @ApiOperation({ summary: 'Asignar/reasignar la conversación a un asesor' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123conv' })
  asignar(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: AsignarConversacionDto,
  ) {
    return this.whatsappService.asignarConversacion(empresaId, user, id, dto);
  }

  @Get('metricas')
  @ApiOperation({ summary: 'Métricas de WhatsApp e IA (últimos 30 días)' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  metricas(@Param('empresaId') empresaId: string) {
    return this.whatsappService.metricas(empresaId);
  }

  @Get('solicitudes-visita')
  @ApiOperation({ summary: 'Listar solicitudes de visita generadas desde WhatsApp/IA' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  findSolicitudes(
    @Param('empresaId') empresaId: string,
    @CurrentUser() user: JwtPayload,
    @Query('estado') estado?: string,
  ) {
    return this.whatsappService.findAllSolicitudesVisita(empresaId, user, estado);
  }

  @Post('conversaciones/:id/solicitud-visita')
  @ApiOperation({ summary: 'Registrar una solicitud de visita desde la conversación' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123conv' })
  crearSolicitud(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CrearSolicitudVisitaDesdeConversacionDto,
  ) {
    return this.whatsappService.crearSolicitudVisita(empresaId, user, id, dto);
  }

  @Patch('solicitudes-visita/:id/confirmar')
  @ApiOperation({ summary: 'Confirmar una solicitud de visita y crear la VisitaPropiedad' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123solicitud' })
  confirmarSolicitud(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ConfirmarSolicitudVisitaDto,
  ) {
    return this.whatsappService.confirmarSolicitudVisita(empresaId, user, id, dto);
  }
}
