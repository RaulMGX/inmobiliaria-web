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
import { CreateVentaDto } from './dto/create-venta.dto';
import { FindVentasQueryDto } from './dto/find-ventas.query.dto';
import { UpdateVentaDto } from './dto/update-venta.dto';
import { VentasService } from './ventas.service';

@ApiTags('Ventas')
@Controller('empresas/:empresaId/ventas')
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una venta' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiCreatedResponse({ description: 'Venta creada correctamente.' })
  create(@Param('empresaId') empresaId: string, @Body() dto: CreateVentaDto) {
    return this.ventasService.create(empresaId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar ventas con filtros, búsqueda, paginación y ordenamiento',
  })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Listado paginado de ventas.' })
  findAll(
    @Param('empresaId') empresaId: string,
    @Query() query: FindVentasQueryDto,
  ) {
    return this.ventasService.findAll(empresaId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una venta por id' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123venta' })
  @ApiOkResponse({ description: 'Venta encontrada.' })
  findOne(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    return this.ventasService.findOne(empresaId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una venta' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123venta' })
  @ApiOkResponse({ description: 'Venta actualizada correctamente.' })
  update(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVentaDto,
  ) {
    return this.ventasService.update(empresaId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar lógicamente una venta' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123venta' })
  @ApiNoContentResponse({ description: 'Venta eliminada lógicamente.' })
  async remove(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    await this.ventasService.remove(empresaId, id);
  }
}

