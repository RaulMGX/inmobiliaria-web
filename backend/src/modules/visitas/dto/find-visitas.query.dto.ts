import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { EstadoVisitaPropiedad } from '../../../infrastructure/database/prisma/generated/enums';

export const VisitaSortBy = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  fechaHora: 'fechaHora',
  estado: 'estado',
} as const;

export const SortDirection = {
  asc: 'asc',
  desc: 'desc',
} as const;

export class FindVisitasQueryDto {
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
    example: 'miraflores',
    description:
      'Busca por nombres/apellidos del cliente, nombre/código de propiedad, nombres del asesor, lugarEncuentro, resultado u observaciones.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: EstadoVisitaPropiedad })
  @IsOptional()
  @IsEnum(EstadoVisitaPropiedad)
  estado?: string;

  @ApiPropertyOptional({ example: 'cm123cliente' })
  @IsOptional()
  @IsString()
  clienteId?: string;

  @ApiPropertyOptional({ example: 'cm123propiedad' })
  @IsOptional()
  @IsString()
  propiedadId?: string;

  @ApiPropertyOptional({ example: 'cm123asesor' })
  @IsOptional()
  @IsString()
  asesorId?: string;

  @ApiPropertyOptional({ example: 'cm123pipeline' })
  @IsOptional()
  @IsString()
  pipelineId?: string;

  @ApiPropertyOptional({ example: 'cm123seguimiento' })
  @IsOptional()
  @IsString()
  seguimientoId?: string;

  @ApiPropertyOptional({ enum: VisitaSortBy, default: VisitaSortBy.fechaHora })
  @IsOptional()
  @IsEnum(VisitaSortBy)
  sortBy?: (typeof VisitaSortBy)[keyof typeof VisitaSortBy] = 'fechaHora';

  @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.desc })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection?: (typeof SortDirection)[keyof typeof SortDirection] = 'desc';
}

