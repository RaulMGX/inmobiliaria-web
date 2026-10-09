import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { EstadoComision } from '../../../infrastructure/database/prisma/generated/enums';

export const ComisionSortBy = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  fechaGeneracion: 'fechaGeneracion',
  fechaPago: 'fechaPago',
  montoComision: 'montoComision',
  porcentajeComision: 'porcentajeComision',
  estado: 'estado',
} as const;

export const SortDirection = {
  asc: 'asc',
  desc: 'desc',
} as const;

export class FindComisionesQueryDto {
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
    example: 'juan',
    description:
      'Busca por nombres/apellidos/correo del asesor, nombre/código de propiedad, nombres/apellidos del cliente, u observaciones.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: EstadoComision })
  @IsOptional()
  @IsEnum(EstadoComision)
  estado?: string;

  @ApiPropertyOptional({ example: 'cm123venta' })
  @IsOptional()
  @IsString()
  ventaId?: string;

  @ApiPropertyOptional({ example: 'cm123asesor' })
  @IsOptional()
  @IsString()
  asesorId?: string;

  @ApiPropertyOptional({ enum: ComisionSortBy, default: ComisionSortBy.fechaGeneracion })
  @IsOptional()
  @IsEnum(ComisionSortBy)
  sortBy?: (typeof ComisionSortBy)[keyof typeof ComisionSortBy] = 'fechaGeneracion';

  @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.desc })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection?: (typeof SortDirection)[keyof typeof SortDirection] = 'desc';
}
