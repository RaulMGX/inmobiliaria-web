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
import { CreatePipelineDto } from './dto/create-pipeline.dto';
import { FindPipelineQueryDto } from './dto/find-pipeline.query.dto';
import { UpdatePipelineDto } from './dto/update-pipeline.dto';
import { PipelineService } from './pipeline.service';

@ApiTags('Pipeline Comercial')
@Controller('empresas/:empresaId/pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una oportunidad comercial' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiCreatedResponse({ description: 'Oportunidad comercial creada correctamente.' })
  create(
    @Param('empresaId') empresaId: string,
    @Body() createPipelineDto: CreatePipelineDto,
  ) {
    return this.pipelineService.create(empresaId, createPipelineDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar oportunidades comerciales con filtros, búsqueda y paginación',
  })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiOkResponse({ description: 'Listado paginado del pipeline comercial.' })
  findAll(
    @Param('empresaId') empresaId: string,
    @Query() query: FindPipelineQueryDto,
  ) {
    return this.pipelineService.findAll(empresaId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una oportunidad comercial por id' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123pipeline' })
  @ApiOkResponse({ description: 'Oportunidad comercial encontrada.' })
  findOne(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    return this.pipelineService.findOne(empresaId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una oportunidad comercial' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123pipeline' })
  @ApiOkResponse({ description: 'Oportunidad comercial actualizada correctamente.' })
  update(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @Body() updatePipelineDto: UpdatePipelineDto,
  ) {
    return this.pipelineService.update(empresaId, id, updatePipelineDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar lógicamente una oportunidad comercial' })
  @ApiParam({ name: 'empresaId', example: 'cm123empresa' })
  @ApiParam({ name: 'id', example: 'cm123pipeline' })
  @ApiNoContentResponse({ description: 'Oportunidad comercial eliminada lógicamente.' })
  async remove(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    await this.pipelineService.remove(empresaId, id);
  }
}

