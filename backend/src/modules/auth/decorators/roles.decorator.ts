import { SetMetadata } from '@nestjs/common';
import type { AppRol } from '../types/auth.types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AppRol[]) => SetMetadata(ROLES_KEY, roles);
