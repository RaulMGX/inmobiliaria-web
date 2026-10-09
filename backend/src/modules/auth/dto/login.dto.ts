import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'asesor@empresa.com' })
  @IsString()
  @IsNotEmpty()
  correo!: string;

  @ApiProperty({ example: 'TuPassword123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;
}
