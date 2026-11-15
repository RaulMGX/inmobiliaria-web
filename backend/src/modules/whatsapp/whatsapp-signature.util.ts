import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifica la cabecera `X-Hub-Signature-256` que Meta envía en cada webhook.
 * Formato esperado: `sha256=<hmac hex>` calculado sobre el cuerpo crudo (raw body).
 */
export function verificarFirmaMeta(
  rawBody: Buffer | undefined,
  firma: string | undefined,
  appSecret: string | undefined,
): boolean {
  if (!appSecret || !rawBody || !firma) return false;

  const [algoritmo, hashRecibido] = firma.split('=');
  if (algoritmo !== 'sha256' || !hashRecibido) return false;

  const hashCalculado = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const esperado = Buffer.from(hashCalculado, 'utf8');
  const recibido = Buffer.from(hashRecibido, 'utf8');
  if (esperado.length !== recibido.length) return false;

  return timingSafeEqual(esperado, recibido);
}

/**
 * Normaliza un teléfono de WhatsApp al formato E.164 sin `+`.
 * WhatsApp entrega números como `51902610409`; si llega un móvil peruano de 9 dígitos
 * se le antepone el código de país `51`.
 */
export function normalizarTelefono(telefono?: string | null): string {
  const soloDigitos = String(telefono ?? '').replace(/\D/g, '');
  if (soloDigitos.length === 9 && soloDigitos.startsWith('9')) return `51${soloDigitos}`;
  return soloDigitos;
}
