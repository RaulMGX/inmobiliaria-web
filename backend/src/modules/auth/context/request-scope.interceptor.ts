import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { from, Observable, switchMap } from 'rxjs';
import type { JwtPayload } from '../types/auth.types';
import { requestScopeStore } from './request-scope';

@Injectable()
export class RequestScopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ user?: JwtPayload; params?: Record<string, string> }>();
    const user = request?.user;
    const rutaEmpresaId = request?.params?.empresaId;

    return from(Promise.resolve()).pipe(
      switchMap(() =>
        new Observable((subscriber) => {
          let subscription: { unsubscribe: () => void } | null = null;
          requestScopeStore.run({ user, rutaEmpresaId }, () => {
            subscription = next.handle().subscribe({
              next: (v) => subscriber.next(v),
              error: (e) => subscriber.error(e),
              complete: () => subscriber.complete(),
            });
          });
          return () => subscription?.unsubscribe?.();
        }),
      ),
    );
  }
}
