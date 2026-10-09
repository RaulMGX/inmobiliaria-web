import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { FindUsuariosQueryDto } from './dto/find-usuarios.query.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuariosService } from './usuarios.service';

@ApiTags('Usuarios')
@Controller('empresas/:empresaId/usuarios')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un usuario (ADMIN/ASESOR) dentro de una empresa (solo ADMIN).',
  })
  @ApiParam({ name: 'empresaId', example: 'emp_0000000000001' })
  @ApiCreatedResponse({ description: 'Usuario creado correctamente.' })
  create(
    @Param('empresaId') empresaId: string,
    @Body() createUsuarioDto: CreateUsuarioDto,
  ) {
    return this.usuariosService.create(empresaId, createUsuarioDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar usuarios de la empresa con filtros y paginación (solo ADMIN).',
  })
  @ApiParam({ name: 'empresaId', example: 'emp_0000000000001' })
  @ApiOkResponse({ description: 'Listado paginado de usuarios.' })
  findAll(
    @Param('empresaId') empresaId: string,
    @Query() query: FindUsuariosQueryDto,
  ) {
    return this.usuariosService.findAll(empresaId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un usuario por ID dentro de la empresa (solo ADMIN).',
  })
  @ApiParam({ name: 'empresaId', example: 'emp_0000000000001' })
  @ApiParam({ name: 'id', example: 'usr_admin_001' })
  @ApiOkResponse({ description: 'Usuario encontrado.' })
  findOne(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    return this.usuariosService.findOne(empresaId, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar datos básicos de un usuario (nombres, correo, rol, activo, teléfono). Solo ADMIN.',
  })
  @ApiParam({ name: 'empresaId', example: 'emp_0000000000001' })
  @ApiParam({ name: 'id', example: 'usr_admin_001' })
  @ApiOkResponse({ description: 'Usuario actualizado correctamente.' })
  update(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
  ) {
    return this.usuariosService.update(empresaId, id, updateUsuarioDto);
  }

  @Patch(':id/activar')
  @ApiOperation({
    summary: 'Alternar estado activo/inactivo de un usuario (solo ADMIN).',
  })
  @ApiParam({ name: 'empresaId', example: 'emp_0000000000001' })
  @ApiParam({ name: 'id', example: 'usr_admin_001' })
  @ApiOkResponse({ description: 'Estado actualizado correctamente.' })
  toggleActive(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    return this.usuariosService.toggleActive(empresaId, id);
  }

  @Patch(':id/password')
  @ApiOperation({
    summary: 'Restablecer o cambiar la contraseña de un usuario (solo ADMIN).',
  })
  @ApiParam({ name: 'empresaId', example: 'emp_0000000000001' })
  @ApiParam({ name: 'id', example: 'usr_admin_001' })
  @ApiOkResponse({ description: 'Contraseña actualizada correctamente.' })
  changePassword(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usuariosService.changePassword(empresaId, id, changePasswordDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar lógicamente (soft delete) un usuario de la empresa (solo ADMIN).',
  })
  @ApiParam({ name: 'empresaId', example: 'emp_0000000000001' })
  @ApiParam({ name: 'id', example: 'usr_admin_001' })
  @ApiNoContentResponse({ description: 'Usuario eliminado lógicamente.' })
  async remove(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    await this.usuariosService.remove(empresaId, id);
  }
}
