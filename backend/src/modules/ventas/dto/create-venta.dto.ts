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
import {
  EstadoVenta,
  MetodoPagoVenta,
} from '../../../infrastructure/database/prisma/generated/enums';

export class CreateVentaDto {
  @ApiProperty({ example: 'cm123reserva' })
  @IsString()
  @IsNotEmpty()
  reservaId!: string;

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

  @ApiPropertyOptional({ enum: EstadoVenta })
  @IsOptional()
  @IsEnum(EstadoVenta)
  estado?: string;

  @ApiProperty({ enum: MetodoPagoVenta })
  @IsEnum(MetodoPagoVenta)
  metodoPago!: string;

  @ApiPropertyOptional({ example: '2026-08-25T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  fechaVenta?: string;

  @ApiProperty({ example: 250000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioFinal!: number;

  @ApiPropertyOptional({ example: 10000, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  descuento?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  impuestos?: number;

  @ApiProperty({ example: 240000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalVenta!: number;

  @ApiPropertyOptional({ example: 'Venta cerrada con descuento por pronto pago.' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

