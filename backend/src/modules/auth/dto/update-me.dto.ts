import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, Matches, IsEmail } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @ApiPropertyOptional({ example: 'Raul Kelvin', maxLength: 120 })
  nombres?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @ApiPropertyOptional({ example: 'Mendoza Guevara', maxLength: 120 })
  apellidos?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Correo no válido.' })
  @MaxLength(255)
  @ApiPropertyOptional({ example: 'raul@antony.com' })
  correo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[0-9+\-\s()]*$/, { message: 'El teléfono solo admite números, +, -, espacios y paréntesis.' })
  @ApiPropertyOptional({ example: '+51 987 654 321', maxLength: 30 })
  telefono?: string;
}

export { PartialType, ApiProperty };
