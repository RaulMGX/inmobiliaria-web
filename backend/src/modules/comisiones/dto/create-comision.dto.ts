import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { EstadoComision } from '../../../infrastructure/database/prisma/generated/enums';

export class CreateComisionDto {
  @ApiProperty({ example: 'cm123venta' })
  @IsString()
  @IsNotEmpty()
  ventaId!: string;

  @ApiProperty({ example: 'cm123asesor' })
  @IsString()
  @IsNotEmpty()
  asesorId!: string;

  @ApiProperty({ example: 3, description: 'Porcentaje de comisión (0-100)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  porcentajeComision!: number;

  @ApiProperty({ example: 7500 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montoComision!: number;

  @ApiPropertyOptional({ enum: EstadoComision })
  @IsOptional()
  @IsEnum(EstadoComision)
  estado?: string;

  @ApiPropertyOptional({ example: '2026-08-25T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  fechaGeneracion?: string;

  @ApiPropertyOptional({ example: '2026-09-01T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  fechaPago?: string;

  @ApiPropertyOptional({ example: 'Comisión por venta de propiedad en Miraflores.' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
