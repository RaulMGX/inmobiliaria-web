import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { EstadoVisitaPropiedad } from '../../../infrastructure/database/prisma/generated/enums';

export class CreateVisitaDto {
  @ApiProperty({ example: '2026-08-10T15:00:00.000Z' })
  @IsDateString()
  fechaHora!: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  duracionEstimada?: number;

  @ApiPropertyOptional({ example: 'Lobby del proyecto' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  lugarEncuentro?: string;

  @ApiPropertyOptional({ enum: EstadoVisitaPropiedad })
  @IsOptional()
  @IsEnum(EstadoVisitaPropiedad)
  estado?: string;

  @ApiPropertyOptional({ example: 'Cliente interesado en avanzar a negociación.' })
  @IsOptional()
  @IsString()
  resultado?: string;

  @ApiPropertyOptional({ example: 'Solicitó nueva visita con familiar.' })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiProperty({ example: 'cm123cliente' })
  @IsString()
  @IsNotEmpty()
  clienteId!: string;

  @ApiProperty({ example: 'cm123asesor' })
  @IsString()
  @IsNotEmpty()
  asesorId!: string;

  @ApiProperty({ example: 'cm123propiedad' })
  @IsString()
  @IsNotEmpty()
  propiedadId!: string;

  @ApiPropertyOptional({ example: 'cm123pipeline' })
  @IsOptional()
  @IsString()
  pipelineId?: string;

  @ApiPropertyOptional({ example: 'cm123seguimiento' })
  @IsOptional()
  @IsString()
  seguimientoId?: string;

  @ApiPropertyOptional({ example: 'cm123visitaAnterior' })
  @IsOptional()
  @IsString()
  reprogramadaDeId?: string;
}

