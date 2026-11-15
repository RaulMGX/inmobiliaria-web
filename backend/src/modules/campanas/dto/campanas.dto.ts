import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCampanaDto {
  @IsString()
  @MaxLength(150)
  nombreCampana!: string;

  @IsIn(['FACEBOOK', 'INSTAGRAM'])
  plataforma!: 'FACEBOOK' | 'INSTAGRAM';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  campaignId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  adsetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  adId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  proyectoIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  propiedadIds?: string[];

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class FindCampanasQueryDto {
  @IsOptional()
  @IsIn(['FACEBOOK', 'INSTAGRAM'])
  plataforma?: 'FACEBOOK' | 'INSTAGRAM';

  @IsOptional()
  @IsString()
  buscar?: string;

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
