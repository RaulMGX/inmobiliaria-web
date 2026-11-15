import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnv } from './config/environment/env.validation';
import { PrismaModule } from './infrastructure/database/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CampanasModule } from './modules/campanas/campanas.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { ComisionesModule } from './modules/comisiones/comisiones.module';
import { ContratosModule } from './modules/contratos/contratos.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { PagosModule } from './modules/pagos/pagos.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
import { PropiedadesModule } from './modules/propiedades/propiedades.module';
import { ProyectosModule } from './modules/proyectos/proyectos.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { ReservasModule } from './modules/reservas/reservas.module';
import { VentasModule } from './modules/ventas/ventas.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { VisitasModule } from './modules/visitas/visitas.module';
import { IntegracionesModule } from './modules/integraciones/integraciones.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: ['.env.local', '.env'],
      load: [configuration],
      validate: validateEnv,
    }),
    AuthModule,
    PrismaModule,
    IntegracionesModule,
    UsuariosModule,
    ClientesModule,
    CampanasModule,
    ComisionesModule,
    ContratosModule,
    DashboardModule,
    NotificacionesModule,
    PagosModule,
    PipelineModule,
    PropiedadesModule,
    ProyectosModule,
    ReportesModule,
    ReservasModule,
    VentasModule,
    VisitasModule,
    WhatsappModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
