import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { EstadoReserva } from '../../../infrastructure/database/prisma/generated/enums';

export const ReservaSortBy = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  fechaReserva: 'fechaReserva',
  fechaVencimiento: 'fechaVencimiento',
  montoSeparacion: 'montoSeparacion',
  estado: 'estado',
} as const;

export const SortDirection = {
  asc: 'asc',
  desc: 'desc',
} as const;

export class FindReservasQueryDto {
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
      'Busca por nombres/apellidos/documento del cliente, nombre/código de propiedad, nombres del asesor u observaciones.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: EstadoReserva })
  @IsOptional()
  @IsEnum(EstadoReserva)
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

  @ApiPropertyOptional({ example: 'cm123visita' })
  @IsOptional()
  @IsString()
  visitaId?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Filtra reservas vencidas a la fecha actual.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  vencidas?: boolean;

  @ApiPropertyOptional({ enum: ReservaSortBy, default: ReservaSortBy.fechaReserva })
  @IsOptional()
  @IsEnum(ReservaSortBy)
  sortBy?: (typeof ReservaSortBy)[keyof typeof ReservaSortBy] = 'fechaReserva';

  @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.desc })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection?: (typeof SortDirection)[keyof typeof SortDirection] = 'desc';
}

