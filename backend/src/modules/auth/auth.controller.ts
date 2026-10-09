import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  PickType,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ChangeMyPasswordDto } from './dto/change-my-password.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { LoginDto } from './dto/login.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import type { JwtPayload } from './types/auth.types';

class RefreshDto {
  @ApiProperty({ example: 'xxxx.refresh.token.xxxx' })
  refreshToken!: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión (correo + password). Devuelve accessToken JWT + refreshToken.' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Renovar accessToken con el refreshToken del login.' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Get('me')
  @Roles('ADMIN', 'ASESOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener el usuario autenticado.' })
  @ApiOkResponse()
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user);
  }

  @Patch('me')
  @Roles('ADMIN', 'ASESOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar datos básicos del usuario autenticado.' })
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateMeDto) {
    return this.authService.updateMe(user, dto);
  }

  @Patch('me/password')
  @Roles('ADMIN', 'ASESOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'El usuario autenticado actualiza su propia contraseña (requiere la contraseña actual).' })
  changeMyPassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangeMyPasswordDto) {
    return this.authService.changeMyPassword(user, dto);
  }

  @Post('logout')
  @Roles('ADMIN', 'ASESOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invalidar refreshToken del usuario autenticado.' })
  logout(@CurrentUser() user: JwtPayload) {
    return this.authService.logout(user);
  }
}
