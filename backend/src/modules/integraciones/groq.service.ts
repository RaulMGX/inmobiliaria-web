import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type MensajeChatIa = { role: 'system' | 'user' | 'assistant'; content: string };

export type AnalisisProspecto = {
  respuesta: string;
  transferir: boolean;
  motivoTransferencia?: string | null;
  resumenComercial?: string | null;
  solicitudVisita?: boolean;
  consentimientoDatos?: boolean;
  calificacion?: {
    nombresCompletos?: string | null;
    tipoInmueble?: string | null;
    ubicacionDeseada?: string | null;
    presupuesto?: number | null;
    inicialDisponible?: number | null;
    intencionCompra?: string | null;
    interesVisita?: boolean;
    dni?: string | null;
  } | null;
};

/**
 * Cliente de Groq (API compatible con OpenAI Chat Completions).
 * Usa `fetch` nativo para no agregar dependencias.
 */
@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string {
    return this.config.get<string>('GROQ_API_KEY') ?? '';
  }

  private get apiUrl(): string {
    return (
      this.config.get<string>('GROQ_API_URL') ??
      'https://api.groq.com/openai/v1/chat/completions'
    );
  }

  private get model(): string {
    return this.config.get<string>('GROQ_MODEL') ?? 'llama-3.3-70b-versatile';
  }

  get configurado(): boolean {
    return Boolean(this.apiKey);
  }

  async chat(
    mensajes: MensajeChatIa[],
    opciones: { jsonMode?: boolean; temperature?: number; maxTokens?: number } = {},
  ): Promise<string> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException('GROQ_API_KEY no está configurado.');
    }

    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: mensajes,
        temperature: opciones.temperature ?? 0.4,
        max_tokens: opciones.maxTokens ?? 1024,
        ...(opciones.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    const json: any = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ServiceUnavailableException(
        `Groq ${res.status}: ${json?.error?.message ?? 'error desconocido'}`,
      );
    }
    const contenido: string = json?.choices?.[0]?.message?.content ?? '';
    if (!contenido) throw new ServiceUnavailableException('Groq devolvió una respuesta vacía.');
    return contenido;
  }

  /**
   * Analiza la conversación y devuelve la respuesta sugerida al cliente
   * más los datos de calificación y la señal de transferencia a un asesor.
   */
  async analizarConversacion(input: {
    empresaNombre: string;
    mensajeActual: string;
    historial: { autor: 'CLIENTE' | 'ASESOR' | 'IA'; contenido: string }[];
    activos?: { proyectos: string[]; propiedades: string[] };
  }): Promise<AnalisisProspecto> {
    const system = [
      `Eres un asistente comercial de la inmobiliaria "${input.empresaNombre}" en Perú.`,
      'Atiendes consultas por WhatsApp con un tono amable, profesional, cercano y comercial.',
      'Escribe en español peruano, de forma natural y breve (máximo 3 frases). Evita respuestas repetitivas o tipo formulario.',
      '',
      'INFORMACIÓN PERMITIDA: puedes comentar proyectos, ubicaciones, características, metros cuadrados,',
      'número de habitaciones y baños, fotografías, videos y disponibilidad, siempre basándote SOLO en el',
      'contexto entregado. Nunca inventes propiedades, precios, ubicaciones, características ni disponibilidad.',
      '',
      'PROHIBIDO (nunca lo hagas):',
      '- Mostrar precios de propiedades.',
      '- Negociar precios.',
      '- Explicar financiamiento, cuotas o intereses.',
      '- Confirmar visitas (solo puedes REGISTRAR una solicitud, nunca confirmarla).',
      '- Separar propiedades o marcarlas como vendidas.',
      '- Realizar evaluaciones crediticias o asegurar elegibilidad (por ejemplo, Techo Propio).',
      '- Mostrar códigos internos, IDs o referencias internas de propiedades (por ejemplo: "casa 0003", "propiedad 0003", "código 0003"). En su lugar, describe la propiedad solo por sus características públicas: tipo de inmueble, ubicación, metros cuadrados, número de habitaciones y baños. El cliente no conoce esos códigos internos.',
      'Si el cliente pregunta por precio o financiamiento, NO respondas el dato: transfiere a un asesor.',
      '',
      'CALIFICACIÓN (recopila de forma progresiva y conversacional):',
      '- Nombres completos.',
      '- Tipo de inmueble buscado.',
      '- Proyecto o propiedad de interés.',
      '- Ubicación deseada.',
      '- Presupuesto.',
      '- Inicial disponible.',
      '- DNI (solo cuando corresponda).',
      '- Intención de compra.',
      '- Interés en programar una visita.',
      'La inicial mínima de la inmobiliaria es S/ 3,000. Pregunta cuánto tiene disponible y verifica si alcanza ese mínimo.',
      'Si tiene MENOS de S/ 3,000: no lo descartes. Sigue mostrándole proyectos, características, imágenes y videos,',
      'registra su situación, NO lo marques como calificado y deriva toda pregunta de financiamiento al asesor.',
      'Si tiene S/ 3,000 o más: informa que puede continuar, solicita nombres completos y DNI, y ANTES de recopilarlos',
      'explica brevemente el propósito del tratamiento de sus datos y pide su consentimiento explícito.',
      'Nunca determines por tu cuenta la elegibilidad del prospecto.',
      '',
      'TRANSFIERE a un asesor humano (transferir = true) cuando:',
      '- El cliente solicita una visita.',
      '- El cliente pregunta por el precio.',
      '- El cliente pregunta por financiamiento.',
      '- El cliente pide hablar con una persona.',
      '- El cliente quiere negociar o separar una propiedad.',
      '- No encuentras información confiable.',
      '- El caso requiere intervención humana.',
      '',
      'Responde SIEMPRE en JSON con este esquema exacto:',
      JSON.stringify({
        respuesta: 'texto a enviar al cliente por WhatsApp',
        transferir: false,
        motivoTransferencia: 'motivo si transferir=true',
        resumenComercial: 'resumen breve del interés del cliente',
        solicitudVisita: false,
        consentimientoDatos: false,
        calificacion: {
          nombresCompletos: null,
          tipoInmueble: null,
          ubicacionDeseada: null,
          presupuesto: null,
          inicialDisponible: null,
          intencionCompra: null,
          interesVisita: false,
          dni: null,
        },
      }),
    ].join('\n');

    const activos = input.activos
      ? `Proyectos disponibles: ${input.activos.proyectos.join(', ') || 'sin registro'}.\nPropiedades destacadas: ${
          input.activos.propiedades.join(', ') || 'sin registro'
        }.`
      : '';

    const mensajes: MensajeChatIa[] = [
      { role: 'system', content: `${system}\n\n${activos}`.trim() },
      ...input.historial.map((h) => ({
        role: h.autor === 'CLIENTE' ? ('user' as const) : ('assistant' as const),
        content: h.contenido,
      })),
      { role: 'user', content: input.mensajeActual },
    ];

    const raw = await this.chat(mensajes, { jsonMode: true });
    return this.parsearAnalisis(raw);
  }

  private parsearAnalisis(raw: string): AnalisisProspecto {
    try {
      const json = JSON.parse(raw);
      return {
        respuesta: String(json?.respuesta ?? '').trim() || 'Gracias por escribirnos, en breve te atenderemos.',
        transferir: Boolean(json?.transferir),
        motivoTransferencia: json?.motivoTransferencia ?? null,
        resumenComercial: json?.resumenComercial ?? null,
        solicitudVisita: Boolean(json?.solicitudVisita),
        consentimientoDatos: Boolean(json?.consentimientoDatos),
        calificacion: json?.calificacion ?? null,
      };
    } catch (e: any) {
      this.logger.warn(`No se pudo parsear la respuesta de Groq como JSON: ${e?.message ?? e}`);
      const texto = raw.trim().slice(0, 900);
      return {
        respuesta: texto || 'Gracias por escribirnos, en breve te atenderemos.',
        transferir: false,
      };
    }
  }
}
