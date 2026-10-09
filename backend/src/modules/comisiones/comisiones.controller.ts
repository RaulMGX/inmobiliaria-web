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
import { ComisionesService } from './comisiones.service';
import { CreateComisionDto } from './dto/create-comision.dto';
import { FindComisionesQueryDto } from './dto/find-comisiones.query.dto';
import { UpdateComisionDto } from './dto/update-comision.dto';

@ApiTags('Comisiones')
@Controller('empresas/:empresaId/comisiones')
export class ComisionesController {
  constructor(private readonly comisionesService: ComisionesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una comisión' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiCreatedResponse({ description: 'Comisión creada correctamente.' })
  create(@Param('empresaId') empresaId: string, @Body() dto: CreateComisionDto) {
    return this.comisionesService.create(empresaId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar comisiones con filtros, búsqueda, paginación y ordenamiento',
  })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Listado paginado de comisiones.' })
  findAll(
    @Param('empresaId') empresaId: string,
    @Query() query: FindComisionesQueryDto,
  ) {
    return this.comisionesService.findAll(empresaId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una comisión por id' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123comision' })
  @ApiOkResponse({ description: 'Comisión encontrada.' })
  findOne(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    return this.comisionesService.findOne(empresaId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una comisión' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123comision' })
  @ApiOkResponse({ description: 'Comisión actualizada correctamente.' })
  update(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @Body() dto: UpdateComisionDto,
  ) {
    return this.comisionesService.update(empresaId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar lógicamente una comisión' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123comision' })
  @ApiNoContentResponse({ description: 'Comisión eliminada lógicamente.' })
  async remove(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    await this.comisionesService.remove(empresaId, id);
  }
}
