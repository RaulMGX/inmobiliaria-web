import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class FindConversacionesQueryDto {
  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  asesorId?: string;

  @IsOptional()
  @IsString()
  buscar?: string;

  @IsOptional()
  @IsIn(['IA', 'HUMANA'])
  modoAtencion?: 'IA' | 'HUMANA';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class EnviarMensajeDto {
  @IsString()
  @MaxLength(4000)
  contenido!: string;
}

export class CambiarModoDto {
  @IsIn(['IA', 'HUMANA'])
  modoAtencion!: 'IA' | 'HUMANA';

  @IsOptional()
  @IsBoolean()
  iaActiva?: boolean;
}

export class AsignarConversacionDto {
  @IsOptional()
  @IsString()
  asesorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  motivo?: string;
}

export class CambiarEstadoConversacionDto {
  @IsIn(['ATENCION_IA', 'PENDIENTE_ASESOR', 'ATENCION_HUMANA', 'CERRADA'])
  estado!: 'ATENCION_IA' | 'PENDIENTE_ASESOR' | 'ATENCION_HUMANA' | 'CERRADA';
}

export class CrearSolicitudVisitaDesdeConversacionDto {
  @IsOptional()
  @IsDateString()
  fechaSolicitada?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  preferenciaHorario?: string;

  @IsOptional()
  @IsString()
  propiedadId?: string;

  @IsOptional()
  @IsString()
  proyectoId?: string;

  @IsOptional()
  @IsString()
  asesorId?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class ConfirmarSolicitudVisitaDto {
  @IsDateString()
  fechaHora!: string;

  @IsOptional()
  @IsString()
  propiedadId?: string;

  @IsOptional()
  @IsString()
  asesorId?: string;

  @IsOptional()
  @IsString()
  lugarEncuentro?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  duracionEstimada?: number;
}
