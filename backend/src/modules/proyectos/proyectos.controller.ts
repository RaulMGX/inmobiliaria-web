import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ProyectosService } from './proyectos.service';

@ApiTags('Proyectos')
@Controller('empresas/:empresaId/proyectos')
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Get()
  @ApiOperation({ summary: 'Listar los proyectos activos de una empresa' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Listado de proyectos de la empresa.' })
  findAll(@Param('empresaId') empresaId: string) {
    return this.proyectosService.findAll(empresaId);
  }
}
