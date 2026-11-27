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

export type PlantillaMeta = {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  rejected_reason?: string | null;
  components: Array<{
    type: string;
    format?: string;
    text?: string;
    example?: { body_text?: string[][]; header_handle?: string[] };
  }>;
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

  private get businessAccountId(): string {
    return this.config.get<string>('WHATSAPP_BUSINESS_ACCOUNT_ID') ?? '';
  }

  /**
   * Intenta resolver el WABA ID a partir del phone number ID o de candidatos conocidos.
   * El ID del env puede ser el asset ID (no funciona para message_templates), así que
   * probamos varios candidatos y verificamos cuál responde correctamente.
   */
  async resolverWabaId(phoneNumberId?: string): Promise<string> {
    const candidatos = new Set<string>();
    if (phoneNumberId) {
      // Intentar resolver desde el phone number ID
      const campos = ['whatsapp_business_account', 'account', 'business_account'];
      for (const campo of campos) {
        try {
          const res: any = await this.solicitudGraph(
            `${phoneNumberId}?fields=${campo}{id}`,
            'GET',
          );
          const wabaId = res?.[campo]?.id;
          if (wabaId) candidatos.add(wabaId);
        } catch {
          // el campo no existe en esta versión, seguimos probando
        }
      }
    }
    if (this.businessAccountId) candidatos.add(this.businessAccountId);
    // Candidato confirmado desde Meta Business Suite (Dream House)
    candidatos.add('3724202217731930');

    // Probar cada candidato haciendo una petición a message_templates
    for (const candidato of candidatos) {
      try {
        await this.solicitudGraph(`${candidato}/message_templates?limit=1`, 'GET');
        this.logger.log(`WABA ID válido confirmado: ${candidato}`);
        return candidato;
      } catch {
        this.logger.debug(`WABA ID ${candidato} no válido para message_templates`);
      }
    }
    return this.businessAccountId;
  }

  private get appId(): string {
    return this.config.get<string>('META_APP_ID') ?? '';
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

  private assertPlantillasConfiguradas(requiereMuestraMultimedia = false) {
    this.assertConfigurado();
    if (!this.businessAccountId) {
      throw new ServiceUnavailableException(
        'Falta WHATSAPP_BUSINESS_ACCOUNT_ID para administrar plantillas de WhatsApp.',
      );
    }
    if (requiereMuestraMultimedia && !this.appId) {
      throw new ServiceUnavailableException(
        'Falta META_APP_ID para subir la muestra multimedia que Meta revisará.',
      );
    }
  }

  private async solicitudGraph<T = any>(
    path: string,
    method: 'GET' | 'POST',
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<T> {
    this.assertConfigurado();
    const esBinario = body instanceof Uint8Array;
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...(body && !esBinario ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(body ? { body: (esBinario ? body : JSON.stringify(body)) as BodyInit } : {}),
    };
    const res = await fetch(`${this.baseUrl}/${path}`, init);
    const json: any = await res.json().catch(() => null);
    if (!res.ok) {
      const error = json?.error ?? {};
      throw new ServiceUnavailableException(
        `Meta Graph API ${res.status}: ${error.message ?? 'error desconocido'} (code ${error.code ?? '-'})`,
      );
    }
    return json as T;
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

  async subirMedia(
    phoneNumberId: string,
    contenido: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<string> {
    this.assertConfigurado();
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mimeType);
    form.append('file', new Blob([new Uint8Array(contenido)], { type: mimeType }), fileName);

    const res = await fetch(`${this.baseUrl}/${phoneNumberId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: form,
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok || !json?.id) {
      const error = json?.error ?? {};
      throw new ServiceUnavailableException(
        `No se pudo subir el archivo a WhatsApp: ${error.message ?? `Meta Graph API ${res.status}`}`,
      );
    }
    return String(json.id);
  }

  enviarUbicacion(
    phoneNumberId: string,
    to: string,
    ubicacion: { latitude: number; longitude: number; name?: string; address?: string },
  ): Promise<ResultadoEnvioMeta> {
    return this.enviar(phoneNumberId, {
      to,
      type: 'location',
      location: {
        latitude: ubicacion.latitude,
        longitude: ubicacion.longitude,
        ...(ubicacion.name ? { name: ubicacion.name } : {}),
        ...(ubicacion.address ? { address: ubicacion.address } : {}),
      },
    });
  }

  enviarPlantilla(
    phoneNumberId: string,
    to: string,
    nombrePlantilla: string,
    idioma: string,
    parametros: string[] = [],
    medio?: { tipo: 'image' | 'video'; id: string },
  ): Promise<ResultadoEnvioMeta> {
    const components: Record<string, unknown>[] = [];
    if (medio) {
      components.push({
        type: 'header',
        parameters: [{ type: medio.tipo, [medio.tipo]: { id: medio.id } }],
      });
    }
    if (parametros.length) {
      components.push({
        type: 'body',
        parameters: parametros.map((p) => ({ type: 'text', text: p })),
      });
    }
    return this.enviar(phoneNumberId, {
      to,
      type: 'template',
      template: {
        name: nombrePlantilla,
        language: { code: idioma },
        ...(components.length ? { components } : {}),
      },
    });
  }

  async listarPlantillas(phoneNumberId?: string): Promise<PlantillaMeta[]> {
    this.assertPlantillasConfiguradas();
    const wabaId = await this.resolverWabaId(phoneNumberId);
    const plantillas: PlantillaMeta[] = [];
    let after: string | undefined;

    for (let pagina = 0; pagina < 10; pagina += 1) {
      const query = new URLSearchParams({
        fields: 'name,status,category,language,components,rejected_reason',
        limit: '100',
      });
      if (after) query.set('after', after);
      const response = await this.solicitudGraph<{
        data?: PlantillaMeta[];
        paging?: { cursors?: { after?: string }; next?: string };
      }>(`${wabaId}/message_templates?${query.toString()}`, 'GET');
      plantillas.push(...(response.data ?? []));
      if (!response.paging?.next || !response.paging.cursors?.after) break;
      after = response.paging.cursors.after;
    }
    return plantillas;
  }

  async crearPlantilla(
    plantilla: {
      name: string;
      language: string;
      category: 'MARKETING' | 'UTILITY';
      body: string;
      headerFormat: 'NONE' | 'IMAGE' | 'VIDEO';
      bodyExamples: string[];
    },
    headerHandle?: string,
    phoneNumberId?: string,
  ) {
    this.assertPlantillasConfiguradas(plantilla.headerFormat !== 'NONE');
    const wabaId = await this.resolverWabaId(phoneNumberId);
    const components: Record<string, unknown>[] = [];
    if (plantilla.headerFormat !== 'NONE') {
      if (!headerHandle) {
        throw new ServiceUnavailableException('Meta requiere una muestra para el encabezado multimedia.');
      }
      components.push({
        type: 'HEADER',
        format: plantilla.headerFormat,
        example: { header_handle: [headerHandle] },
      });
    }
    const bodyComponent: Record<string, unknown> = {
      type: 'BODY',
      text: plantilla.body,
    };
    if (plantilla.bodyExamples.length) {
      bodyComponent.example = { body_text: [plantilla.bodyExamples] };
    }
    components.push(bodyComponent);

    return this.solicitudGraph(`${wabaId}/message_templates`, 'POST', {
      name: plantilla.name,
      language: plantilla.language,
      category: plantilla.category,
      parameter_format: 'positional',
      components,
    });
  }

  async subirMuestraPlantilla(
    fileName: string,
    contenido: Buffer,
    mimeType: string,
  ): Promise<string> {
    this.assertPlantillasConfiguradas(true);
    const query = new URLSearchParams({
      file_name: fileName,
      file_length: String(contenido.length),
      file_type: mimeType,
    });
    const sesion = await this.solicitudGraph<{ id?: string }>(
      `${this.appId}/uploads?${query.toString()}`,
      'POST',
    );
    if (!sesion.id) {
      throw new ServiceUnavailableException('Meta no devolvió una sesión para subir la muestra multimedia.');
    }
    const response = await this.solicitudGraph<{ h?: string }>(
      sesion.id,
      'POST',
      new Uint8Array(contenido),
      { Authorization: `OAuth ${this.accessToken}`, file_offset: '0' },
    );
    if (!response.h) {
      throw new ServiceUnavailableException('Meta no devolvió el identificador de la muestra multimedia.');
    }
    return response.h;
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
