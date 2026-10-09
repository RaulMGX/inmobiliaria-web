import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Express } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { RequestScopeInterceptor } from './modules/auth/context/request-scope.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const apiPrefix = configService.get<string>('app.apiPrefix') ?? 'api/v1';
  const port = configService.get<number>('app.port') ?? 3000;
  const appName = configService.get<string>('app.name') ?? 'CMR Antony Backend';
  const swaggerEnabled = configService.get<boolean>('docs.enabled') ?? false;
  const swaggerPath = configService.get<string>('docs.path') ?? 'docs';
  const swaggerEndpoint = `${apiPrefix}/${swaggerPath}`.replace(/\/{2,}/g, '/');
  const expressApp = app.getHttpAdapter().getInstance() as Express;

  const devOrigins = [
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
    /^http:\/\/0\.0\.0\.0:\d+$/,
  ];
  const isNodeEnvDev = (process.env.NODE_ENV ?? 'development') !== 'production';
  const allowedOriginsRaw = process.env.CORS_ALLOWED_ORIGINS ?? '';
  const allowedOrigins = allowedOriginsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const prodOriginRegex = allowedOrigins
    .filter((s) => s.includes('*'))
    .map((s) => new RegExp('^' + s.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'));
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (isNodeEnvDev && devOrigins.some((r) => r.test(origin))) {
        return callback(null, true);
      }
      if (!isNodeEnvDev) {
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (prodOriginRegex.some((r) => r.test(origin))) return callback(null, true);
        return callback(new Error('Origen CORS no permitido: ' + origin));
      }
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'Origin',
      'X-Requested-With',
      'Cache-Control',
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  expressApp.disable('x-powered-by');
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.setGlobalPrefix(apiPrefix);
  app.useGlobalInterceptors(new RequestScopeInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle(appName)
      .setDescription('API base del CRM Inmobiliario multiempresa CMR Antony.')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addServer(`/${apiPrefix}`, 'Prefijo base de la API')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(swaggerEndpoint, app, document, {
      customSiteTitle: `${appName} - Swagger`,
    });
  }

  await app.listen(port, '0.0.0.0');

  Logger.log(
    `${appName} disponible en http://0.0.0.0:${port}/${apiPrefix}`,
    'Bootstrap',
  );

  if (swaggerEnabled) {
    Logger.log(
      `Documentacion disponible en http://localhost:${port}/${swaggerEndpoint}`,
      'Bootstrap',
    );
  }
}

void bootstrap();
