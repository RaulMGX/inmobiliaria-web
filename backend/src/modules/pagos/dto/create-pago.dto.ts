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
  EstadoPago,
  MetodoPagoPago,
} from '../../../infrastructure/database/prisma/generated/enums';

export class CreatePagoDto {
  @ApiProperty({ example: 'cm123venta' })
  @IsString()
  @IsNotEmpty()
  ventaId!: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numeroCuota?: number;

  @ApiPropertyOptional({ example: '2026-08-30T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;

  @ApiPropertyOptional({ example: '2026-08-25T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  fechaPago?: string;

  @ApiProperty({ example: 10000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto!: number;

  @ApiPropertyOptional({ enum: EstadoPago, default: EstadoPago.PAGADO })
  @IsOptional()
  @IsEnum(EstadoPago)
  estado?: string;

  @ApiPropertyOptional({ enum: MetodoPagoPago })
  @IsOptional()
  @IsEnum(MetodoPagoPago)
  metodoPago?: string;

  @ApiPropertyOptional({ example: 'OP-987654' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  numeroOperacion?: string;

  @ApiPropertyOptional({ example: 'Pago inicial de separación.' })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiPropertyOptional({ example: 'cm123usuario' })
  @IsOptional()
  @IsString()
  registradoPorId?: string;
}

