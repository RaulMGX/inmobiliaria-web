import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { TipoNotificacion } from '../../../infrastructure/database/prisma/generated/enums';

export class FindNotificacionesQueryDto {
  @ApiPropertyOptional({ example: 'cm123asesor', description: 'Filtrar por asesor (obligatorio para usuarios no admin)' })
  @IsOptional()
  @IsString()
  asesorId?: string;

  @ApiPropertyOptional({ enum: TipoNotificacion })
  @IsOptional()
  @IsEnum(TipoNotificacion)
  tipo?: string;

  @ApiPropertyOptional({ example: true, description: 'true = solo leídas, false = solo no leídas' })
  @IsOptional()
  @Transform(({ value }) => {
    let v: any = Array.isArray(value) ? value[0] : value;
    if (v === 'true' || v === '1' || v === 1 || v === true) return true;
    if (v === 'false' || v === '0' || v === 0 || v === false) return false;
    if (v === 'null' || v === null || v === undefined || v === '') return undefined as any;
    return Boolean(v);
  })
  @IsBoolean()
  leida?: boolean;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;
}

export class MarcarLeidaDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  leida!: boolean;
}
