import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Cliente mínimo de Supabase Storage (REST) para almacenar la media de WhatsApp.
 * Bucket privado + URLs firmadas de corta duración.
 */
@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);

  constructor(private readonly config: ConfigService) {}

  private get url(): string {
    return (this.config.get<string>('SUPABASE_URL') ?? '').replace(/\/+$/, '');
  }

  private get serviceKey(): string {
    return this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  }

  get bucket(): string {
    return this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'whatsapp-media';
  }

  get configurado(): boolean {
    return Boolean(this.url && this.serviceKey);
  }

  private assertConfigurado() {
    if (!this.configurado) {
      throw new ServiceUnavailableException(
        'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no están configurados para el almacenamiento.',
      );
    }
  }

  /**
   * Sube un archivo al bucket. Devuelve el path relativo dentro del bucket.
   * `carpeta` suele ser algo como `empresas/{empresaId}/conversaciones/{conversacionId}`.
   */
  async subirArchivo(
    carpeta: string,
    nombreArchivo: string,
    contenido: Buffer,
    mimeType: string,
  ): Promise<string> {
    this.assertConfigurado();
    const path = `${carpeta.replace(/^\/+|\/+$/g, '')}/${nombreArchivo}`;
    const res = await fetch(`${this.url}/storage/v1/object/${this.bucket}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
        'Content-Type': mimeType || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: new Uint8Array(contenido),
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      this.logger.error(`Error subiendo a Supabase Storage (${res.status}): ${detalle.slice(0, 300)}`);
      throw new ServiceUnavailableException('No se pudo subir el archivo a Supabase Storage.');
    }
    return path;
  }

  /** Genera una URL firmada temporal para un objeto del bucket. */
  async crearUrlFirmada(path: string, expiresInSegundos = 3600): Promise<string | null> {
    if (!this.configurado || !path) return null;
    const res = await fetch(`${this.url}/storage/v1/object/sign/${this.bucket}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: expiresInSegundos }),
    });
    if (!res.ok) {
      this.logger.warn(`No se pudo firmar la URL del objeto ${path} (${res.status}).`);
      return null;
    }
    const json: any = await res.json().catch(() => null);
    const signed: string | undefined = json?.signedURL;
    return signed ? `${this.url}/storage/v1${signed}` : null;
  }
}
