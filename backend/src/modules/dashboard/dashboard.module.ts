import { Module } from '@nestjs/common';
import { KpisController } from './kpis/kpis.controller';
import { KpisService } from './kpis/kpis.service';

@Module({
  controllers: [KpisController],
  providers: [KpisService],
})
export class DashboardModule {}

