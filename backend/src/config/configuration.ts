import { envDefaults } from './environment/env.defaults';

const toBoolean = (
  value: string | undefined,
  defaultValue: boolean,
): boolean => {
  if (value === undefined) {
    return defaultValue;
  }

  return value.toLowerCase() === 'true';
};

const toNumber = (value: string | undefined, defaultValue: number): number => {
  if (value === undefined) {
    return defaultValue;
  }

  const parsedValue = Number(value);

  return Number.isNaN(parsedValue) ? defaultValue : parsedValue;
};

export default () => ({
  app: {
    name: process.env.APP_NAME ?? envDefaults.APP_NAME,
    env: process.env.NODE_ENV ?? envDefaults.NODE_ENV,
    port: toNumber(process.env.PORT, Number(envDefaults.PORT)),
    apiPrefix: process.env.API_PREFIX ?? envDefaults.API_PREFIX,
  },
  docs: {
    enabled: toBoolean(process.env.SWAGGER_ENABLED, false),
    path: process.env.SWAGGER_PATH ?? envDefaults.SWAGGER_PATH,
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
});
