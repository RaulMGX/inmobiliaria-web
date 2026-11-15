import { plainToInstance } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';
import { envDefaults } from './env.defaults';

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  APP_NAME!: string;

  @IsIn(['development', 'test', 'production'])
  NODE_ENV!: 'development' | 'test' | 'production';

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  API_PREFIX!: string;

  @IsBooleanString()
  SWAGGER_ENABLED!: string;

  @IsString()
  @IsNotEmpty()
  SWAGGER_PATH!: string;

  @IsString()
  @IsOptional()
  DATABASE_URL!: string;

  // --- WhatsApp Cloud API (Meta) ---
  @IsString()
  @IsOptional()
  WHATSAPP_ACCESS_TOKEN?: string;

  @IsString()
  @IsOptional()
  WHATSAPP_PHONE_NUMBER_ID?: string;

  @IsString()
  @IsOptional()
  WHATSAPP_BUSINESS_ACCOUNT_ID?: string;

  @IsString()
  @IsOptional()
  META_APP_ID?: string;

  @IsString()
  @IsOptional()
  META_APP_SECRET?: string;

  @IsString()
  @IsOptional()
  META_WEBHOOK_VERIFY_TOKEN?: string;

  @IsString()
  @IsOptional()
  META_GRAPH_API_VERSION?: string;

  @IsString()
  @IsOptional()
  META_PAGE_ID?: string;

  @IsString()
  @IsOptional()
  INSTAGRAM_ACCOUNT_ID?: string;

  // --- Inteligencia Artificial (Groq) ---
  @IsString()
  @IsOptional()
  GROQ_API_KEY?: string;

  @IsString()
  @IsOptional()
  GROQ_MODEL?: string;

  @IsString()
  @IsOptional()
  GROQ_API_URL?: string;

  // --- Supabase Storage ---
  @IsString()
  @IsOptional()
  SUPABASE_URL?: string;

  @IsString()
  @IsOptional()
  SUPABASE_SERVICE_ROLE_KEY?: string;

  @IsString()
  @IsOptional()
  SUPABASE_STORAGE_BUCKET?: string;

  // --- Cron interno / tareas programadas ---
  @IsString()
  @IsOptional()
  INTERNAL_CRON_SECRET?: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToInstance(
    EnvironmentVariables,
    {
      ...envDefaults,
      ...config,
    },
    {
      enableImplicitConversion: true,
    },
  );

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const formattedErrors = errors
      .map((error) => {
        const constraints = error.constraints
          ? Object.values(error.constraints).join(', ')
          : 'valor invalido';

        return `${error.property}: ${constraints}`;
      })
      .join('; ');

    throw new Error(`Configuracion de entorno invalida: ${formattedErrors}`);
  }

  return validatedConfig;
}
