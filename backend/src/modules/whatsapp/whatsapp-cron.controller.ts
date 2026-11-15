import { Controller, Headers, HttpCode, Param, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { WhatsappService } from './whatsapp.service';

/**
 * Endpoints internos invocados por un cron externo (cron-job.org, Render Cron, etc.).
 * Se protegen con el header `x-cron-secret` en lugar de JWT.
 * Además, al invocarse periódicamente, mantienen despierto el servicio free de Render.
 */
@ApiExcludeController()
@Public()
@Controller('internal/whatsapp')
export class WhatsappCronController {
  constructor(
    private readonly config: ConfigService,
    private readonly whatsappService: WhatsappService,
  ) {}

  private validarSecreto(secreto?: string) {
    const esperado = this.config.get<string>('INTERNAL_CRON_SECRET') ?? '';
    if (!esperado || secreto !== esperado) {
      throw new UnauthorizedException('Secreto de cron inválido.');
    }
  }

  @Post('escalar')
  @HttpCode(200)
  escalar(@Headers('x-cron-secret') secreto?: string) {
    this.validarSecreto(secreto);
    return this.whatsappService.escalarAsignacionesVencidas();
  }

  @Post('sincronizar/:empresaId')
  @HttpCode(200)
  sincronizar(@Param('empresaId') empresaId: string, @Headers('x-cron-secret') secreto?: string) {
    this.validarSecreto(secreto);
    return this.whatsappService.estadoIntegracion(empresaId);
  }
}
