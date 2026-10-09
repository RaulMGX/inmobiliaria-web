import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  EstadoPago,
  MetodoPagoPago,
} from '../../../infrastructure/database/prisma/generated/enums';

export const PagoSortBy = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  fechaPago: 'fechaPago',
  fechaVencimiento: 'fechaVencimiento',
  monto: 'monto',
  estado: 'estado',
} as const;

export const SortDirection = {
  asc: 'asc',
  desc: 'desc',
} as const;

export class FindPagosQueryDto {
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
    example: 'OP-987',
    description:
      'Busca por número de operación, observaciones, nombres/apellidos/documento del cliente, o código/nombre de propiedad (via venta).',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: EstadoPago })
  @IsOptional()
  @IsEnum(EstadoPago)
  estado?: string;

  @ApiPropertyOptional({ enum: MetodoPagoPago })
  @IsOptional()
  @IsEnum(MetodoPagoPago)
  metodoPago?: string;

  @ApiPropertyOptional({ example: 'cm123venta' })
  @IsOptional()
  @IsString()
  ventaId?: string;

  @ApiPropertyOptional({ example: 'cm123cliente' })
  @IsOptional()
  @IsString()
  clienteId?: string;

  @ApiPropertyOptional({ example: 'cm123usuario' })
  @IsOptional()
  @IsString()
  registradoPorId?: string;

  @ApiPropertyOptional({ enum: PagoSortBy, default: PagoSortBy.createdAt })
  @IsOptional()
  @IsEnum(PagoSortBy)
  sortBy?: (typeof PagoSortBy)[keyof typeof PagoSortBy] = 'createdAt';

  @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.desc })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection?: (typeof SortDirection)[keyof typeof SortDirection] = 'desc';
}

