import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
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

  @Post('conversaciones/:id/medios')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 16 * 1024 * 1024 },
      fileFilter: (_req: unknown, file: { mimetype: string }, callback: (error: Error | null, acceptFile: boolean) => void) => {
        if (['image/jpeg', 'image/png', 'video/mp4'].includes(file.mimetype)) {
          callback(null, true);
          return;
        }
        callback(new BadRequestException('Solo se permiten imágenes JPG/PNG y videos MP4.'), false);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Enviar una imagen o un video por WhatsApp (asesor o administrador)' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123conv' })
  enviarMedio(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile()
    file:
      | { buffer: Buffer; originalname: string; mimetype: string; size: number }
      | undefined,
    @Body('caption') caption?: string,
  ) {
    if (!file) throw new BadRequestException('Selecciona una imagen JPG/PNG o un video MP4.');
    return this.whatsappService.enviarMedio(empresaId, user, id, file, caption ?? '');
  }

  @Get('plantillas')
  @ApiOperation({ summary: 'Listar plantillas y estados de revisión de Meta' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  listarPlantillas(
    @Param('empresaId') empresaId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.whatsappService.listarPlantillas(empresaId, user);
  }

  @Post('plantillas')
  @UseInterceptors(
    FileInterceptor('headerSample', {
      limits: { fileSize: 16 * 1024 * 1024 },
      fileFilter: (_req: unknown, file: { mimetype: string }, callback: (error: Error | null, acceptFile: boolean) => void) => {
        if (['image/jpeg', 'image/png', 'video/mp4'].includes(file.mimetype)) {
          callback(null, true);
          return;
        }
        callback(new BadRequestException('La muestra debe ser JPG, PNG o MP4.'), false);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Enviar una plantilla nueva a revisión de Meta (administrador)' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  crearPlantilla(
    @Param('empresaId') empresaId: string,
    @CurrentUser() user: JwtPayload,
    @Body('name') name: string,
    @Body('language') language: string,
    @Body('category') category: string,
    @Body('body') body: string,
    @Body('headerFormat') headerFormat: string,
    @Body('bodyExamples') bodyExamples: string,
    @UploadedFile()
    headerSample:
      | { buffer: Buffer; originalname: string; mimetype: string; size: number }
      | undefined,
  ) {
    return this.whatsappService.crearPlantilla(
      empresaId,
      user,
      { name, language, category, body, headerFormat, bodyExamples },
      headerSample,
    );
  }

  @Post('conversaciones/:id/plantillas')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 16 * 1024 * 1024 },
      fileFilter: (_req: unknown, file: { mimetype: string }, callback: (error: Error | null, acceptFile: boolean) => void) => {
        if (['image/jpeg', 'image/png', 'video/mp4'].includes(file.mimetype)) {
          callback(null, true);
          return;
        }
        callback(new BadRequestException('Solo se permiten imágenes JPG/PNG y videos MP4.'), false);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Enviar una plantilla aprobada a un cliente' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123conv' })
  enviarPlantillaConversacion(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body('name') name: string,
    @Body('language') language: string,
    @Body('bodyParams') bodyParams: string,
    @Body('consentimientoConfirmado') consentimientoConfirmado: string,
    @UploadedFile()
    file:
      | { buffer: Buffer; originalname: string; mimetype: string; size: number }
      | undefined,
  ) {
    return this.whatsappService.enviarPlantillaConversacion(
      empresaId,
      user,
      id,
      { name, language, bodyParams, consentimientoConfirmado },
      file,
    );
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
