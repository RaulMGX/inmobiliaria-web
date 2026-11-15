import {
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { WhatsappService } from './whatsapp.service';
import { verificarFirmaMeta } from './whatsapp-signature.util';

@ApiExcludeController()
@Public()
@Controller('whatsapp/webhook')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly whatsappService: WhatsappService,
  ) {}

  /** Verificación inicial del webhook por parte de Meta (hub.challenge). */
  @Get()
  verificar(@Req() req: Request, @Res() res: Response) {
    const parametros = new URL(req.url, 'http://localhost').searchParams;
    const modo = parametros.get('hub.mode');
    const token = parametros.get('hub.verify_token');
    const challenge = parametros.get('hub.challenge');
    const esperado = this.config.get<string>('META_WEBHOOK_VERIFY_TOKEN') ?? '';

    if (modo === 'subscribe' && token && esperado && token === esperado) {
      this.logger.log('Webhook de WhatsApp verificado correctamente por Meta.');
      return res.status(200).send(challenge);
    }
    this.logger.warn(
      `Verificación de webhook rechazada: modoSubscribe=${modo === 'subscribe'} tokenPresente=${Boolean(token)} tokenConfigurado=${Boolean(esperado)} coinciden=${Boolean(token && esperado && token === esperado)} challengePresente=${Boolean(challenge)}`,
    );
    return res.status(403).send('Forbidden');
  }

  /** Recepción de eventos (mensajes entrantes y actualizaciones de estado). */
  @Post()
  @HttpCode(200)
  recibir(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
    const appSecret = this.config.get<string>('META_APP_SECRET') ?? '';
    const firma = req.headers['x-hub-signature-256'] as string | undefined;

    if (appSecret) {
      if (!verificarFirmaMeta(req.rawBody, firma, appSecret)) {
        this.logger.warn('Webhook rechazado: firma X-Hub-Signature-256 inválida.');
        return res.status(401).send('Firma inválida');
      }
    } else {
      this.logger.warn(
        'META_APP_SECRET no configurado: el webhook se acepta SIN verificar la firma. Configure el secreto antes de producción.',
      );
    }

    // Meta exige respuesta 2xx inmediata; el procesamiento continúa en segundo plano.
    res.status(200).send('EVENT_RECEIVED');

    void this.whatsappService
      .procesarWebhook(req.body)
      .catch((e: any) => this.logger.error(`Error procesando webhook: ${e?.message ?? e}`));

    return undefined;
  }
}
