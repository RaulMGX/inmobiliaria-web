import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  EstadoContrato,
  TipoContrato,
} from '../../../infrastructure/database/prisma/generated/enums';

export const ContratoSortBy = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  fechaEmision: 'fechaEmision',
  fechaFirma: 'fechaFirma',
  montoContrato: 'montoContrato',
  estado: 'estado',
  version: 'version',
} as const;

export const SortDirection = {
  asc: 'asc',
  desc: 'desc',
} as const;

export class FindContratosQueryDto {
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
    example: 'CTR-2026',
    description:
      'Busca por número de contrato, observaciones, ruta del PDF, cliente, propiedad o responsable.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: EstadoContrato })
  @IsOptional()
  @IsEnum(EstadoContrato)
  estado?: string;

  @ApiPropertyOptional({ enum: TipoContrato })
  @IsOptional()
  @IsEnum(TipoContrato)
  tipo?: string;

  @ApiPropertyOptional({ example: 'cm123venta' })
  @IsOptional()
  @IsString()
  ventaId?: string;

  @ApiPropertyOptional({ example: 'cm123cliente' })
  @IsOptional()
  @IsString()
  clienteId?: string;

  @ApiPropertyOptional({ example: 'cm123propiedad' })
  @IsOptional()
  @IsString()
  propiedadId?: string;

  @ApiPropertyOptional({ example: 'cm123usuario' })
  @IsOptional()
  @IsString()
  responsableId?: string;

  @ApiPropertyOptional({ enum: ContratoSortBy, default: ContratoSortBy.fechaEmision })
  @IsOptional()
  @IsEnum(ContratoSortBy)
  sortBy?: (typeof ContratoSortBy)[keyof typeof ContratoSortBy] = 'fechaEmision';

  @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.desc })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection?: (typeof SortDirection)[keyof typeof SortDirection] = 'desc';
}

