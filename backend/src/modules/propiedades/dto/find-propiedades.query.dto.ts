import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { EstadoPropiedad, TipoPropiedad } from '../../../infrastructure/database/prisma/generated/enums';

export const PropiedadSortBy = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  codigoInterno: 'codigoInterno',
  nombre: 'nombre',
  precio: 'precio',
  estado: 'estado',
} as const;

export const SortDirection = {
  asc: 'asc',
  desc: 'desc',
} as const;

export class FindPropiedadesQueryDto {
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
    example: 'DH-DEP-0001',
    description:
      'Busca por código interno, nombre, dirección, distrito o nombre de proyecto.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: EstadoPropiedad })
  @IsOptional()
  @IsEnum(EstadoPropiedad)
  estado?: string;

  @ApiPropertyOptional({ enum: TipoPropiedad })
  @IsOptional()
  @IsEnum(TipoPropiedad)
  tipoPropiedad?: string;

  @ApiPropertyOptional({ example: 'cm123proyecto' })
  @IsOptional()
  @IsString()
  proyectoId?: string;

  @ApiPropertyOptional({
    description: 'Filtra disponibilidad (true: solo DISPONIBLE; false: no DISPONIBLE).',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  disponible?: boolean;

  @ApiPropertyOptional({ enum: PropiedadSortBy, default: PropiedadSortBy.createdAt })
  @IsOptional()
  @IsEnum(PropiedadSortBy)
  sortBy?: (typeof PropiedadSortBy)[keyof typeof PropiedadSortBy] = 'createdAt';

  @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.desc })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection?: (typeof SortDirection)[keyof typeof SortDirection] = 'desc';
}

