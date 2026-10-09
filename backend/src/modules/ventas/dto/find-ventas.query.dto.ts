import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  EstadoVenta,
  MetodoPagoVenta,
} from '../../../infrastructure/database/prisma/generated/enums';

export const VentaSortBy = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  fechaVenta: 'fechaVenta',
  totalVenta: 'totalVenta',
  estado: 'estado',
} as const;

export const SortDirection = {
  asc: 'asc',
  desc: 'desc',
} as const;

export class FindVentasQueryDto {
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
      'Busca por nombres/apellidos/documento/correo del cliente, nombre/código de propiedad, nombres del asesor, u observaciones.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: EstadoVenta })
  @IsOptional()
  @IsEnum(EstadoVenta)
  estado?: string;

  @ApiPropertyOptional({ enum: MetodoPagoVenta })
  @IsOptional()
  @IsEnum(MetodoPagoVenta)
  metodoPago?: string;

  @ApiPropertyOptional({ example: 'cm123cliente' })
  @IsOptional()
  @IsString()
  clienteId?: string;

  @ApiPropertyOptional({ example: 'cm123propiedad' })
  @IsOptional()
  @IsString()
  propiedadId?: string;

  @ApiPropertyOptional({ example: 'cm123reserva' })
  @IsOptional()
  @IsString()
  reservaId?: string;

  @ApiPropertyOptional({ example: 'cm123asesor' })
  @IsOptional()
  @IsString()
  asesorId?: string;

  @ApiPropertyOptional({ enum: VentaSortBy, default: VentaSortBy.fechaVenta })
  @IsOptional()
  @IsEnum(VentaSortBy)
  sortBy?: (typeof VentaSortBy)[keyof typeof VentaSortBy] = 'fechaVenta';

  @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.desc })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection?: (typeof SortDirection)[keyof typeof SortDirection] = 'desc';
}

