import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  EstadoContrato,
  TipoContrato,
} from '../../../infrastructure/database/prisma/generated/enums';

export class CreateContratoDto {
  @ApiProperty({ example: 'CTR-2026-0001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  numeroContrato!: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;

  @ApiProperty({ example: 'cm123venta' })
  @IsString()
  @IsNotEmpty()
  ventaId!: string;

  @ApiProperty({ example: 'cm123cliente' })
  @IsString()
  @IsNotEmpty()
  clienteId!: string;

  @ApiProperty({ example: 'cm123propiedad' })
  @IsString()
  @IsNotEmpty()
  propiedadId!: string;

  @ApiProperty({ example: 'cm123usuario' })
  @IsString()
  @IsNotEmpty()
  responsableId!: string;

  @ApiPropertyOptional({ example: '2026-08-26T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  fechaEmision?: string;

  @ApiPropertyOptional({ example: '2026-08-27T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  fechaFirma?: string;

  @ApiPropertyOptional({ example: '2027-08-27T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;

  @ApiPropertyOptional({ enum: EstadoContrato })
  @IsOptional()
  @IsEnum(EstadoContrato)
  estado?: string;

  @ApiProperty({ enum: TipoContrato })
  @IsEnum(TipoContrato)
  tipo!: string;

  @ApiProperty({ example: 240000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  montoContrato!: number;

  @ApiPropertyOptional({ example: 'Contrato listo para firma notarial.' })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiPropertyOptional({ example: '/uploads/contratos/ctr-2026-0001.pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rutaPdfFirmado?: string;

  @ApiPropertyOptional({ example: 'sha256-hash-del-documento' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  hashDocumento?: string;
}

