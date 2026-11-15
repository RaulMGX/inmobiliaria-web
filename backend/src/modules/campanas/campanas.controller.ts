import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CampanasService } from './campanas.service';
import { CreateCampanaDto, FindCampanasQueryDto } from './dto/campanas.dto';
import { UpdateCampanaDto } from './dto/update-campana.dto';

@ApiTags('Campañas')
@Controller('empresas/:empresaId/campanas')
export class CampanasController {
  constructor(private readonly campanasService: CampanasService) {}

  @Get()
  @ApiOperation({ summary: 'Listar campañas de Meta Ads (Facebook / Instagram)' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Listado paginado de campañas.' })
  findAll(@Param('empresaId') empresaId: string, @Query() query: FindCampanasQueryDto) {
    return this.campanasService.findAll(empresaId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una campaña' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123campana' })
  findOne(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    return this.campanasService.findOne(empresaId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar una campaña asociada a Facebook/Instagram Ads' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  create(@Param('empresaId') empresaId: string, @Body() dto: CreateCampanaDto) {
    return this.campanasService.create(empresaId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una campaña' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123campana' })
  update(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCampanaDto,
  ) {
    return this.campanasService.update(empresaId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar (soft delete) una campaña' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123campana' })
  remove(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    return this.campanasService.remove(empresaId, id);
  }
}
