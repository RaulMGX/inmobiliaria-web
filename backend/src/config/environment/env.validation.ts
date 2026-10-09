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
