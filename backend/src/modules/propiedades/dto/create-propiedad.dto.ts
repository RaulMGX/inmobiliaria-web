import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EstadoPropiedad, TipoPropiedad } from '../../../infrastructure/database/prisma/generated/enums';

export class CreatePropiedadDto {
  @ApiProperty({ example: 'DH-DEP-0001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  codigoInterno!: string;

  @ApiProperty({ example: 'Departamento 1203' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre!: string;

  @ApiProperty({ enum: TipoPropiedad })
  @IsEnum(TipoPropiedad)
  tipoPropiedad!: string;

  @ApiPropertyOptional({ enum: EstadoPropiedad })
  @IsOptional()
  @IsEnum(EstadoPropiedad)
  estado?: string;

  @ApiProperty({ example: 250000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precio!: number;

  @ApiPropertyOptional({ example: 120.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  areaTotal?: number;

  @ApiPropertyOptional({ example: 98.2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  areaConstruida?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  habitaciones?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  banos?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estacionamientos?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  piso?: number;

  @ApiPropertyOptional({ example: 'Av. Arequipa 123' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion?: string;

  @ApiPropertyOptional({ example: 'Miraflores' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  distrito?: string;

  @ApiPropertyOptional({ example: 'Lima' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ciudad?: string;

  @ApiPropertyOptional({ example: -12.12121212 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-90)
  @Max(90)
  latitud?: number;

  @ApiPropertyOptional({ example: -77.03030303 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-180)
  @Max(180)
  longitud?: number;

  @ApiPropertyOptional({ example: 'Excelente vista al mar.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string;

  @ApiPropertyOptional({ example: 'cm123proyecto' })
  @IsOptional()
  @IsString()
  proyectoId!: string;

  @ApiPropertyOptional({ example: 'Proyecto Los Olivos' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  proyectoNombre?: string;
}
