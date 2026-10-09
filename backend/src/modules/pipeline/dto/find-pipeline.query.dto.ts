import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  EtapaPipelineComercial,
  PrioridadPipelineComercial,
} from '../../../infrastructure/database/prisma/generated/enums';

export const PipelineSortBy = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  fechaIngreso: 'fechaIngreso',
  proximaFechaSeguimiento: 'proximaFechaSeguimiento',
  probabilidadCierre: 'probabilidadCierre',
  etapa: 'etapa',
  prioridad: 'prioridad',
} as const;

export const SortDirection = {
  asc: 'asc',
  desc: 'desc',
} as const;

export class FindPipelineQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 'anthony',
    description:
      'Busca por nombres/apellidos del cliente, correo, documento, nombres del asesor, motivo de pérdida u observaciones.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: EtapaPipelineComercial })
  @IsOptional()
  @IsEnum(EtapaPipelineComercial)
  etapa?: string;

  @ApiPropertyOptional({ enum: PrioridadPipelineComercial })
  @IsOptional()
  @IsEnum(PrioridadPipelineComercial)
  prioridad?: string;

  @ApiPropertyOptional({ example: 'cm123cliente' })
  @IsOptional()
  @IsString()
  clienteId?: string;

  @ApiPropertyOptional({ example: 'cm123asesor' })
  @IsOptional()
  @IsString()
  asesorId?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Filtra oportunidades con próxima fecha de seguimiento vencida.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  vencidas?: boolean;

  @ApiPropertyOptional({ enum: PipelineSortBy, default: PipelineSortBy.createdAt })
  @IsOptional()
  @IsEnum(PipelineSortBy)
  sortBy?: (typeof PipelineSortBy)[keyof typeof PipelineSortBy] = 'createdAt';

  @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.desc })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection?: (typeof SortDirection)[keyof typeof SortDirection] = 'desc';
}

