export const envDefaults = {
  APP_NAME: 'CMR Antony Backend',
  NODE_ENV: 'development',
  PORT: '3000',
  API_PREFIX: 'api/v1',
  SWAGGER_ENABLED: 'false',
  SWAGGER_PATH: 'docs',
} as const;

export type AppEnvironment = keyof typeof envDefaults | 'DATABASE_URL';
