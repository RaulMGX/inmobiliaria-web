import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { KpisOverviewQueryDto } from './dto/kpis-overview.query.dto';
import { KpisService } from './kpis.service';

@ApiTags('Dashboard')
@Controller('empresas/:empresaId/dashboard/kpis')
export class KpisController {
  constructor(private readonly kpisService: KpisService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Obtener KPIs generales del dashboard (ventas, clientes, visitas, reservas, top asesores)',
  })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'KPIs del dashboard.' })
  overview(
    @Param('empresaId') empresaId: string,
    @Query() query: KpisOverviewQueryDto,
  ) {
    return this.kpisService.overview(empresaId, query);
  }
}
