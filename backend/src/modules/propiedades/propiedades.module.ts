import { Module } from '@nestjs/common';
import { PropiedadesController } from './propiedades.controller';
import { PropiedadesService } from './propiedades.service';

@Module({
  controllers: [PropiedadesController],
  providers: [PropiedadesService],
})
export class PropiedadesModule {}

