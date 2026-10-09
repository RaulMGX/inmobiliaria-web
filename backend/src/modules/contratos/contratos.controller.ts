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
import { ContratosService } from './contratos.service';
import { CreateContratoDto } from './dto/create-contrato.dto';
import { FindContratosQueryDto } from './dto/find-contratos.query.dto';
import { UpdateContratoDto } from './dto/update-contrato.dto';

@ApiTags('Contratos')
@Controller('empresas/:empresaId/contratos')
export class ContratosController {
  constructor(private readonly contratosService: ContratosService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un contrato' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiCreatedResponse({ description: 'Contrato creado correctamente.' })
  create(
    @Param('empresaId') empresaId: string,
    @Body() dto: CreateContratoDto,
  ) {
    return this.contratosService.create(empresaId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar contratos con filtros, búsqueda, paginación y ordenamiento',
  })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Listado paginado de contratos.' })
  findAll(
    @Param('empresaId') empresaId: string,
    @Query() query: FindContratosQueryDto,
  ) {
    return this.contratosService.findAll(empresaId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un contrato por id' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123contrato' })
  @ApiOkResponse({ description: 'Contrato encontrado.' })
  findOne(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    return this.contratosService.findOne(empresaId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un contrato' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123contrato' })
  @ApiOkResponse({ description: 'Contrato actualizado correctamente.' })
  update(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @Body() dto: UpdateContratoDto,
  ) {
    return this.contratosService.update(empresaId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar lógicamente un contrato' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123contrato' })
  @ApiNoContentResponse({ description: 'Contrato eliminado lógicamente.' })
  async remove(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    await this.contratosService.remove(empresaId, id);
  }
}

