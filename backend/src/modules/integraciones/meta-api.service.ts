import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ResultadoEnvioMeta = {
  ok: boolean;
  messageId?: string;
  errorCode?: string;
  errorDetalle?: string;
};

export type MediaDescargada = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
};

/**
 * Cliente de WhatsApp Business Cloud API (Meta Graph API).
 * Usa `fetch` nativo (Node 18+) para no agregar dependencias.
 */
@Injectable()
export class MetaApiService {
  private readonly logger = new Logger(MetaApiService.name);

  constructor(private readonly config: ConfigService) {}

  private get graphVersion(): string {
    return this.config.get<string>('META_GRAPH_API_VERSION') ?? 'v21.0';
  }

  private get accessToken(): string {
    return this.config.get<string>('WHATSAPP_ACCESS_TOKEN') ?? '';
  }

  private get baseUrl(): string {
    return `https://graph.facebook.com/${this.graphVersion}`;
  }

  private assertConfigurado() {
    if (!this.accessToken) {
      throw new ServiceUnavailableException(
        'WHATSAPP_ACCESS_TOKEN no está configurado. No se pueden enviar mensajes.',
      );
    }
  }

  private async post<T = any>(path: string, body: unknown): Promise<T> {
    this.assertConfigurado();
    const res = await fetch(`${this.baseUrl}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok) {
      const error = json?.error ?? {};
      throw new ServiceUnavailableException(
        `Meta Graph API ${res.status}: ${error.message ?? 'error desconocido'} (code ${error.code ?? '-'})`,
      );
    }
    return json as T;
  }

  private async enviar(phoneNumberId: string, payload: Record<string, unknown>): Promise<ResultadoEnvioMeta> {
    try {
      const json = await this.post<{ messages?: { id: string }[] }>(
        `${phoneNumberId}/messages`,
        { messaging_product: 'whatsapp', ...payload },
      );
      return { ok: true, messageId: json?.messages?.[0]?.id };
    } catch (e: any) {
      this.logger.error(`Error enviando mensaje WhatsApp: ${e?.message ?? e}`);
      const detalle = String(e?.message ?? e);
      const codeMatch = detalle.match(/code (\d+)/);
      return { ok: false, errorCode: codeMatch?.[1], errorDetalle: detalle.slice(0, 500) };
    }
  }

  enviarTexto(phoneNumberId: string, to: string, texto: string): Promise<ResultadoEnvioMeta> {
    return this.enviar(phoneNumberId, {
      to,
      type: 'text',
      text: { preview_url: false, body: texto },
    });
  }

  enviarMedia(
    phoneNumberId: string,
    to: string,
    tipo: 'image' | 'video' | 'audio' | 'document',
    media: { id?: string; link?: string },
    extra?: { caption?: string; filename?: string },
  ): Promise<ResultadoEnvioMeta> {
    return this.enviar(phoneNumberId, {
      to,
      type: tipo,
      [tipo]: {
        ...(media.id ? { id: media.id } : { link: media.link }),
        ...(extra?.caption ? { caption: extra.caption } : {}),
        ...(extra?.filename ? { filename: extra.filename } : {}),
      },
    });
  }

  enviarPlantilla(
    phoneNumberId: string,
    to: string,
    nombrePlantilla: string,
    idioma: string,
    parametros: string[] = [],
  ): Promise<ResultadoEnvioMeta> {
    const components = parametros.length
      ? [{ type: 'body', parameters: parametros.map((p) => ({ type: 'text', text: p })) }]
      : undefined;
    return this.enviar(phoneNumberId, {
      to,
      type: 'template',
      template: {
        name: nombrePlantilla,
        language: { code: idioma },
        ...(components ? { components } : {}),
      },
    });
  }

  marcarLeido(phoneNumberId: string, messageId: string): Promise<ResultadoEnvioMeta> {
    return this.enviar(phoneNumberId, { status: 'read', message_id: messageId });
  }

  /** Descarga el binario de un mediaId (imagen, audio, video, documento). */
  async descargarMedia(mediaId: string): Promise<MediaDescargada> {
    this.assertConfigurado();
    const metaRes = await fetch(`${this.baseUrl}/${mediaId}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!metaRes.ok) {
      throw new ServiceUnavailableException(`No se pudo obtener metadata del media ${mediaId}`);
    }
    const meta: any = await metaRes.json();
    const downloadUrl: string = meta?.url;
    if (!downloadUrl) throw new ServiceUnavailableException(`Media ${mediaId} sin URL de descarga.`);

    const binRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!binRes.ok) throw new ServiceUnavailableException(`No se pudo descargar el media ${mediaId}.`);

    const arrayBuffer = await binRes.arrayBuffer();
    const mimeType = meta?.mime_type ?? binRes.headers.get('content-type') ?? 'application/octet-stream';
    const extension = (mimeType.split('/')[1] ?? 'bin').split(';')[0];
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType,
      fileName: `${mediaId}.${extension}`,
    };
  }
}
