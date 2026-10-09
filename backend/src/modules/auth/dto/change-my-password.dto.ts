import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, Matches } from 'class-validator';

export class ChangeMyPasswordDto {
  @IsString()
  @MinLength(1)
  @ApiProperty({ example: 'Admin123$', description: 'Contraseña actual del usuario.' })
  actualPassword!: string;

  @IsString()
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres.' })
  @Matches(/[A-Z]/, { message: 'La nueva contraseña debe contener al menos una letra mayúscula.' })
  @Matches(/[a-z]/, { message: 'La nueva contraseña debe contener al menos una letra minúscula.' })
  @Matches(/\d/, { message: 'La nueva contraseña debe contener al menos un número.' })
  @Matches(/[^\p{L}\p{N}]/u, {
    message: 'La nueva contraseña debe contener al menos un símbolo.',
  })
  @ApiProperty({
    example: 'NuevaClave99$',
    minLength: 8,
    description: 'Nueva contraseña (mín. 8, mayús., minús., número y símbolo).',
  })
  password!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'NuevaClave99$' })
  confirmPassword?: string;
}
