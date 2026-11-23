import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateUsuarioDto {
  @ApiPropertyOptional({ example: 'Carlos' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombres?: string;

  @ApiPropertyOptional({ example: 'Gómez Pérez' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  apellidos?: string;

  @ApiPropertyOptional({ example: 'carlos.asesor@antony.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  correo?: string;

  @ApiPropertyOptional({ example: '+51 999 000 111' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @ApiPropertyOptional({ example: 'ASESOR', enum: ['ADMIN', 'ASESOR'] })
  @IsOptional()
  @IsIn(['ADMIN', 'ASESOR'])
  rolNombre?: 'ADMIN' | 'ASESOR';

  @ApiPropertyOptional({ example: '08:00', description: 'Hora de inicio de turno (HH:MM, 24h). Enviar null para borrar.' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Hora de inicio inválida (use HH:MM).' })
  horaInicioTurno?: string | null;

  @ApiPropertyOptional({ example: '14:00', description: 'Hora de fin de turno (HH:MM, 24h). Enviar null para borrar.' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Hora de fin inválida (use HH:MM).' })
  horaFinTurno?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
