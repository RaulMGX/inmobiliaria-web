import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
  MaxLength,
  MinLength,
} from 'class-validator';

const PASSWORD_RULES: any = {
  message:
    'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo.',
  minLength: 8,
  minLowercase: 1,
  minUppercase: 1,
  minNumbers: 1,
  minSymbols: 1,
};

export class CreateUsuarioDto {
  @ApiProperty({ example: 'Carlos' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombres!: string;

  @ApiProperty({ example: 'Gómez Pérez' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  apellidos!: string;

  @ApiProperty({ example: 'carlos.asesor@antony.com' })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(120)
  correo!: string;

  @ApiProperty({
    example: 'Asesor123$',
    description: 'Contraseña temporal del asesor (se recomienda cambiar en primer login).',
  })
  @IsString()
  @IsNotEmpty()
  @IsStrongPassword(PASSWORD_RULES)
  password!: string;

  @ApiPropertyOptional({ example: '+51 999 000 111' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @ApiPropertyOptional({ example: 'ASESOR', enum: ['ADMIN', 'ASESOR'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['ADMIN', 'ASESOR'])
  rolNombre!: 'ADMIN' | 'ASESOR';

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  active?: boolean;
}
