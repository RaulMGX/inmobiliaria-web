import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import {
  EstadoCivilCliente,
  EstadoCliente,
  MedioCaptacionCliente,
  MetodoPagoPreferidoCliente,
  MonedaCliente,
  MotivoCompraCliente,
  TipoDocumentoCliente,
  TipoPropiedad,
  UrgenciaCompraCliente,
} from '../../../infrastructure/database/prisma/generated/enums';

export class CreateClienteDto {
  @ApiProperty({ example: 'Anthony' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombres!: string;

  @ApiProperty({ example: 'Pérez Gómez' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  apellidos!: string;

  @ApiPropertyOptional({ enum: TipoDocumentoCliente })
  @IsOptional()
  @IsEnum(TipoDocumentoCliente)
  tipoDocumento?: string;

  @ApiPropertyOptional({ example: '71234567' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  numeroDocumento?: string;

  @ApiProperty({ example: '987654321' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  celular!: string;

  @ApiPropertyOptional({ example: '014567890' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @ApiPropertyOptional({ example: 'cliente@correo.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  correo?: string;

  @ApiPropertyOptional({ example: '1992-08-25' })
  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @ApiPropertyOptional({ enum: EstadoCivilCliente })
  @IsOptional()
  @IsEnum(EstadoCivilCliente)
  estadoCivil?: string;

  @ApiPropertyOptional({ example: 'Arquitecto' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ocupacion?: string;

  @ApiPropertyOptional({ example: 'Constructora Lima SAC' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  empresaDondeTrabaja?: string;

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

  @ApiPropertyOptional({ example: 'Av. Larco 123' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion?: string;

  @ApiPropertyOptional({ example: 150000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  presupuestoMinimo?: number;

  @ApiPropertyOptional({ example: 250000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  presupuestoMaximo?: number;

  @ApiPropertyOptional({ enum: MonedaCliente })
  @IsOptional()
  @IsEnum(MonedaCliente)
  moneda?: string;

  @ApiProperty({ enum: MedioCaptacionCliente })
  @IsEnum(MedioCaptacionCliente)
  medioCaptacion!: string;

  @ApiPropertyOptional({ enum: EstadoCliente })
  @IsOptional()
  @IsEnum(EstadoCliente)
  estado?: string;

  @ApiPropertyOptional({ example: 'Interesado en departamentos de 3 habitaciones.' })
  @IsOptional()
  @IsString()
  observaciones?: string;

  // ===== Perfil de compra (nuevos campos) =====
  @ApiPropertyOptional({
    enum: TipoPropiedad,
    description: 'Tipo de propiedad que busca el cliente (enum TipoPropiedad)',
  })
  @IsOptional()
  @IsEnum(TipoPropiedad)
  tipoPropiedadInteres?: string;

  @ApiPropertyOptional({ example: 'Departamento 2D con balcón, vista al mar' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  propiedadInteresDetalle?: string;

  @ApiPropertyOptional({ enum: MotivoCompraCliente })
  @IsOptional()
  @IsEnum(MotivoCompraCliente)
  motivoCompra?: string;

  @ApiPropertyOptional({ enum: MetodoPagoPreferidoCliente })
  @IsOptional()
  @IsEnum(MetodoPagoPreferidoCliente)
  metodoPagoPreferido?: string;

  @ApiPropertyOptional({ example: 'BCP - Pre-aprobado por 200,000' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  bancoPreferencia?: string;

  @ApiPropertyOptional({ example: 'Carta pre-aprobación N°12345, monto USD 200,000, vence 31/12/2026' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  preAprobacionDetalle?: string;

  @ApiPropertyOptional({ enum: UrgenciaCompraCliente })
  @IsOptional()
  @IsEnum(UrgenciaCompraCliente)
  urgenciaCompra?: string;
}

