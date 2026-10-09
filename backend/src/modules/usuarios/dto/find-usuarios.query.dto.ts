import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const UsuarioSortBy = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  nombres: 'nombres',
  apellidos: 'apellidos',
  correo: 'correo',
  lastLogin: 'lastLogin',
} as const;

export const SortDirection = {
  asc: 'asc',
  desc: 'desc',
} as const;

export class FindUsuariosQueryDto {
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
    example: 'antony',
    description: 'Busca por nombres, apellidos, correo o teléfono.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['ADMIN', 'ASESOR'] })
  @IsOptional()
  @IsIn(['ADMIN', 'ASESOR'])
  rolNombre?: 'ADMIN' | 'ASESOR';

  @ApiPropertyOptional({
    description: 'Filtrar solo usuarios activos o inactivos. Si no se envía incluye ambos.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ enum: UsuarioSortBy, default: UsuarioSortBy.createdAt })
  @IsOptional()
  @IsIn(Object.values(UsuarioSortBy))
  sortBy?: (typeof UsuarioSortBy)[keyof typeof UsuarioSortBy] = 'createdAt';

  @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.desc })
  @IsOptional()
  @IsIn(Object.values(SortDirection))
  sortDirection?: (typeof SortDirection)[keyof typeof SortDirection] = 'desc';
}
