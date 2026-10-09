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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { FindClientesQueryDto } from './dto/find-clientes.query.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@ApiTags('Clientes')
@Controller('empresas/:empresaId/clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un cliente para una empresa' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiCreatedResponse({ description: 'Cliente creado correctamente.' })
  create(
    @Param('empresaId') empresaId: string,
    @Body() createClienteDto: CreateClienteDto,
  ) {
    return this.clientesService.create(empresaId, createClienteDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar clientes con filtros, paginación y ordenamiento' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Listado paginado de clientes.' })
  findAll(
    @Param('empresaId') empresaId: string,
    @Query() query: FindClientesQueryDto,
  ) {
    return this.clientesService.findAll(empresaId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un cliente por id dentro de una empresa' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123cliente' })
  @ApiOkResponse({ description: 'Cliente encontrado.' })
  findOne(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    return this.clientesService.findOne(empresaId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un cliente dentro de una empresa' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123cliente' })
  @ApiOkResponse({ description: 'Cliente actualizado correctamente.' })
  update(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @Body() updateClienteDto: UpdateClienteDto,
  ) {
    return this.clientesService.update(empresaId, id, updateClienteDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar lógicamente un cliente' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123cliente' })
  @ApiNoContentResponse({ description: 'Cliente eliminado lógicamente.' })
  async remove(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    await this.clientesService.remove(empresaId, id);
  }
}

