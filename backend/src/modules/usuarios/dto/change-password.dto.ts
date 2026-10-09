import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsStrongPassword } from 'class-validator';

const PASSWORD_RULES: any = {
  message:
    'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo.',
  minLength: 8,
  minLowercase: 1,
  minUppercase: 1,
  minNumbers: 1,
  minSymbols: 1,
};

export class ChangePasswordDto {
  @ApiProperty({
    example: 'NuevaPassword123$',
    description: 'Nueva contraseña para el usuario (restablecer/cambiar).',
  })
  @IsString()
  @IsNotEmpty()
  @IsStrongPassword(PASSWORD_RULES)
  password!: string;
}
