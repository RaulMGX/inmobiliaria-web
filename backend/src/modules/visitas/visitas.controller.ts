import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateVisitaDto } from './dto/create-visita.dto';
import { FindVisitasQueryDto } from './dto/find-visitas.query.dto';
import { UpdateVisitaDto } from './dto/update-visita.dto';
import { VisitasService } from './visitas.service';

@ApiTags('Visitas')
@Controller('empresas/:empresaId/visitas')
export class VisitasController {
  constructor(private readonly visitasService: VisitasService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una visita' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiCreatedResponse({ description: 'Visita creada correctamente.' })
  create(
    @Param('empresaId') empresaId: string,
    @Body() createVisitaDto: CreateVisitaDto,
  ) {
    return this.visitasService.create(empresaId, createVisitaDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar visitas con filtros, búsqueda, paginación y ordenamiento',
  })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Listado paginado de visitas.' })
  findAll(
    @Param('empresaId') empresaId: string,
    @Query() query: FindVisitasQueryDto,
  ) {
    return this.visitasService.findAll(empresaId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una visita por id' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123visita' })
  @ApiOkResponse({ description: 'Visita encontrada.' })
  findOne(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    return this.visitasService.findOne(empresaId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una visita' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123visita' })
  @ApiOkResponse({ description: 'Visita actualizada correctamente.' })
  update(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @Body() updateVisitaDto: UpdateVisitaDto,
  ) {
    return this.visitasService.update(empresaId, id, updateVisitaDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar lógicamente una visita' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123visita' })
  @ApiNoContentResponse({ description: 'Visita eliminada lógicamente.' })
  async remove(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    await this.visitasService.remove(empresaId, id);
  }
}

