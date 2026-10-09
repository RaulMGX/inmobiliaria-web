import { AsyncLocalStorage } from 'async_hooks';
import type { JwtPayload } from '../types/auth.types';

export interface RequestScope {
  user?: JwtPayload;
  rutaEmpresaId?: string;
}

export const requestScopeStore = new AsyncLocalStorage<RequestScope | undefined>();

export function getScopeOrNull(): RequestScope | undefined {
  return requestScopeStore.getStore();
}

export function getCurrentUser(): JwtPayload | undefined {
  return requestScopeStore.getStore()?.user;
}
