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
import { CreatePropiedadDto } from './dto/create-propiedad.dto';
import { FindPropiedadesQueryDto } from './dto/find-propiedades.query.dto';
import { UpdatePropiedadDto } from './dto/update-propiedad.dto';
import { PropiedadesService } from './propiedades.service';

@ApiTags('Propiedades')
@Controller('empresas/:empresaId/propiedades')
export class PropiedadesController {
  constructor(private readonly propiedadesService: PropiedadesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una propiedad para una empresa' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiCreatedResponse({ description: 'Propiedad creada correctamente.' })
  create(
    @Param('empresaId') empresaId: string,
    @Body() createPropiedadDto: CreatePropiedadDto,
  ) {
    return this.propiedadesService.create(empresaId, createPropiedadDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar propiedades con filtros, paginación, ordenamiento y búsqueda',
  })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Listado paginado de propiedades.' })
  findAll(
    @Param('empresaId') empresaId: string,
    @Query() query: FindPropiedadesQueryDto,
  ) {
    return this.propiedadesService.findAll(empresaId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una propiedad por id dentro de una empresa' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123propiedad' })
  @ApiOkResponse({ description: 'Propiedad encontrada.' })
  findOne(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    return this.propiedadesService.findOne(empresaId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una propiedad dentro de una empresa' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123propiedad' })
  @ApiOkResponse({ description: 'Propiedad actualizada correctamente.' })
  update(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @Body() updatePropiedadDto: UpdatePropiedadDto,
  ) {
    return this.propiedadesService.update(empresaId, id, updatePropiedadDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar lógicamente una propiedad' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123propiedad' })
  @ApiNoContentResponse({ description: 'Propiedad eliminada lógicamente.' })
  async remove(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    await this.propiedadesService.remove(empresaId, id);
  }
}

