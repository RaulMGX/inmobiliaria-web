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
import { CreatePagoDto } from './dto/create-pago.dto';
import { FindPagosQueryDto } from './dto/find-pagos.query.dto';
import { UpdatePagoDto } from './dto/update-pago.dto';
import { PagosService } from './pagos.service';

@ApiTags('Pagos')
@Controller('empresas/:empresaId/pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un pago' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiCreatedResponse({ description: 'Pago registrado correctamente.' })
  create(@Param('empresaId') empresaId: string, @Body() dto: CreatePagoDto) {
    return this.pagosService.create(empresaId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar pagos con filtros, búsqueda, paginación y ordenamiento',
  })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Listado paginado de pagos.' })
  findAll(@Param('empresaId') empresaId: string, @Query() query: FindPagosQueryDto) {
    return this.pagosService.findAll(empresaId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un pago por id' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123pago' })
  @ApiOkResponse({ description: 'Pago encontrado.' })
  findOne(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    return this.pagosService.findOne(empresaId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un pago' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123pago' })
  @ApiOkResponse({ description: 'Pago actualizado correctamente.' })
  update(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePagoDto,
  ) {
    return this.pagosService.update(empresaId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar lógicamente un pago' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123pago' })
  @ApiNoContentResponse({ description: 'Pago eliminado lógicamente.' })
  async remove(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    await this.pagosService.remove(empresaId, id);
  }
}

