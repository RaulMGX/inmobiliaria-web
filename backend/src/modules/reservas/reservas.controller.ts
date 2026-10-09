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
import { CreateReservaDto } from './dto/create-reserva.dto';
import { FindReservasQueryDto } from './dto/find-reservas.query.dto';
import { UpdateReservaDto } from './dto/update-reserva.dto';
import { ReservasService } from './reservas.service';

@ApiTags('Reservas')
@Controller('empresas/:empresaId/reservas')
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una reserva' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiCreatedResponse({ description: 'Reserva creada correctamente.' })
  create(
    @Param('empresaId') empresaId: string,
    @Body() createReservaDto: CreateReservaDto,
  ) {
    return this.reservasService.create(empresaId, createReservaDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar reservas con filtros, búsqueda, paginación y ordenamiento',
  })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Listado paginado de reservas.' })
  findAll(
    @Param('empresaId') empresaId: string,
    @Query() query: FindReservasQueryDto,
  ) {
    return this.reservasService.findAll(empresaId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una reserva por id' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123reserva' })
  @ApiOkResponse({ description: 'Reserva encontrada.' })
  findOne(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    return this.reservasService.findOne(empresaId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una reserva' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123reserva' })
  @ApiOkResponse({ description: 'Reserva actualizada correctamente.' })
  update(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @Body() updateReservaDto: UpdateReservaDto,
  ) {
    return this.reservasService.update(empresaId, id, updateReservaDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar lógicamente una reserva' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123reserva' })
  @ApiNoContentResponse({ description: 'Reserva eliminada lógicamente.' })
  async remove(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    await this.reservasService.remove(empresaId, id);
  }
}

