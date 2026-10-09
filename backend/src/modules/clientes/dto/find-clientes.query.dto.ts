import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { EstadoCliente } from '../../../infrastructure/database/prisma/generated/enums';

export const ClienteSortBy = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  nombres: 'nombres',
  apellidos: 'apellidos',
  estado: 'estado',
} as const;

export const SortDirection = {
  asc: 'asc',
  desc: 'desc',
} as const;

export class FindClientesQueryDto {
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
    description: 'Busca por nombres, apellidos, documento, correo o celular.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: EstadoCliente })
  @IsOptional()
  @IsEnum(EstadoCliente)
  estado?: string;

  @ApiPropertyOptional({ enum: ClienteSortBy, default: ClienteSortBy.createdAt })
  @IsOptional()
  @IsEnum(ClienteSortBy)
  sortBy?: (typeof ClienteSortBy)[keyof typeof ClienteSortBy] = 'createdAt';

  @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.desc })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection?: (typeof SortDirection)[keyof typeof SortDirection] = 'desc';
}

