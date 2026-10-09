import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { EstadoReserva } from '../../../infrastructure/database/prisma/generated/enums';

export class CreateReservaDto {
  @ApiProperty({ example: 'cm123cliente' })
  @IsString()
  @IsNotEmpty()
  clienteId!: string;

  @ApiProperty({ example: 'cm123propiedad' })
  @IsString()
  @IsNotEmpty()
  propiedadId!: string;

  @ApiProperty({ example: 'cm123asesor' })
  @IsString()
  @IsNotEmpty()
  asesorId!: string;

  @ApiPropertyOptional({ example: 'cm123pipeline' })
  @IsOptional()
  @IsString()
  pipelineId?: string;

  @ApiPropertyOptional({ example: 'cm123visita' })
  @IsOptional()
  @IsString()
  visitaId?: string;

  @ApiProperty({ example: 5000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montoSeparacion!: number;

  @ApiPropertyOptional({ example: '2026-08-12T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  fechaReserva?: string;

  @ApiProperty({ example: '2026-08-20T10:00:00.000Z' })
  @IsDateString()
  fechaVencimiento!: string;

  @ApiPropertyOptional({ enum: EstadoReserva })
  @IsOptional()
  @IsEnum(EstadoReserva)
  estado?: string;

  @ApiPropertyOptional({ example: 'Cliente separa unidad por una semana.' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

