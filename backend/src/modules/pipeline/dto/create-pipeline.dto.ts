import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsDecimal,
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
import {
  EtapaPipelineComercial,
  OrigenLead,
  PrioridadPipelineComercial,
  TipoPropiedad,
} from '../../../infrastructure/database/prisma/generated/enums';

export class CreatePipelineDto {
  @ApiProperty({ example: 'cm123cliente' })
  @IsString()
  @IsNotEmpty()
  clienteId!: string;

  @ApiProperty({ example: 'cm123asesor' })
  @IsString()
  @IsNotEmpty()
  asesorId!: string;

  @ApiPropertyOptional({ example: 'cm123propiedad' })
  @IsOptional()
  @IsString()
  propiedadId?: string;

  @ApiPropertyOptional({ enum: EtapaPipelineComercial })
  @IsOptional()
  @IsEnum(EtapaPipelineComercial)
  etapa?: string;

  @ApiPropertyOptional({ example: '2026-08-03T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  fechaIngreso?: string;

  @ApiPropertyOptional({ example: '2026-08-05T15:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  fechaUltimoSeguimiento?: string;

  @ApiPropertyOptional({ example: '2026-08-10T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  proximaFechaSeguimiento?: string;

  @ApiPropertyOptional({ enum: PrioridadPipelineComercial })
  @IsOptional()
  @IsEnum(PrioridadPipelineComercial)
  prioridad?: string;

  @ApiPropertyOptional({ example: 65 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  probabilidadCierre?: number;

  @ApiPropertyOptional({ example: 250000.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  montoEstimado?: number;

  @ApiPropertyOptional({ enum: OrigenLead })
  @IsOptional()
  @IsEnum(OrigenLead)
  origen?: string;

  @ApiPropertyOptional({ example: 300000.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  presupuestoMaximo?: number;

  @ApiPropertyOptional({ example: 'Miraflores' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  zonaInteres?: string;

  @ApiPropertyOptional({ enum: TipoPropiedad })
  @IsOptional()
  @IsEnum(TipoPropiedad)
  tipoPropiedadInteres?: string;

  @ApiPropertyOptional({ example: 'El cliente no califica para crédito.' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  motivoPerdida?: string;

  @ApiPropertyOptional({ example: 'Cliente interesado en proyecto en Miraflores.' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

