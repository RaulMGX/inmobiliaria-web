import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import type { Prisma, PrismaClient as TPrismaClient } from './generated/client';
import { PrismaClient } from './generated/client';
import { getScopeOrNull } from '../../../modules/auth/context/request-scope';
import type { JwtPayload } from '../../../modules/auth/types/auth.types';

type PrismaExtended = TPrismaClient & Record<string, any>;

const MODELOS_CON_ASESOR = new Set<string>([
  'pipelineComercial',
  'visitaPropiedad',
  'reserva',
  'venta',
  'seguimientoAgenda',
  'comision',
  'notificacion',
]);

const MODELOS_CON_EMPRESA = new Set<string>([
  'cliente',
  'rol',
  'usuario',
  'proyecto',
  'pipelineComercial',
  'seguimientoAgenda',
  'visitaPropiedad',
  'reserva',
  'venta',
  'pago',
  'comision',
  'notificacion',
]);

function setKeyIfMissing(obj: any, dotted: string, value: any) {
  if (!obj || typeof obj !== 'object' || !dotted) return;
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!p) continue;
    if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p];
  }
  const last = parts[parts.length - 1];
  if (last && cur[last] === undefined) cur[last] = value;
}

function aplicarFiltroOwn(user: JwtPayload, modelo: string, data: any, isList: boolean) {
  if (user.rolNombre !== 'ASESOR') return data;
  if (!MODELOS_CON_ASESOR.has(modelo)) return data;
  if (isList && Array.isArray(data)) {
    return data.filter((r) => r == null || typeof r !== 'object' || (r as any).asesorId === user.sub);
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if ('data' in data && Array.isArray((data as any).data)) {
      return {
        ...data,
        data: (data as any).data.filter((r: any) => r == null || typeof r !== 'object' || r.asesorId === user.sub),
      };
    }
    if (typeof (data as any).asesorId !== 'undefined') {
      return (data as any).asesorId === user.sub ? data : null;
    }
  }
  return data;
}

function aplicarScope(user: JwtPayload | undefined, rutaEmpresaId: string | undefined, modelo: string, args: any, action: string) {
  const tieneWhere = [
    'findUnique', 'findFirst', 'findMany', 'count', 'aggregate', 'groupBy',
    'update', 'updateMany', 'delete', 'deleteMany', 'upsert',
  ].includes(action);

  if (rutaEmpresaId && MODELOS_CON_EMPRESA.has(modelo) && modelo !== 'empresa' && tieneWhere) {
    if (action === 'upsert') {
      setKeyIfMissing(args, 'where.empresaId', rutaEmpresaId);
      setKeyIfMissing(args, 'create.empresaId', rutaEmpresaId);
      setKeyIfMissing(args, 'update.empresaId', rutaEmpresaId);
    } else if (action === 'update') {
      setKeyIfMissing(args, 'where.empresaId', rutaEmpresaId);
      setKeyIfMissing(args, 'data.empresaId', rutaEmpresaId);
    } else if (action === 'updateMany') {
      setKeyIfMissing(args, 'where.empresaId', rutaEmpresaId);
      setKeyIfMissing(args, 'data.empresaId', rutaEmpresaId);
    } else if (action === 'delete' || action === 'deleteMany') {
      setKeyIfMissing(args, 'where.empresaId', rutaEmpresaId);
    } else {
      setKeyIfMissing(args, 'where.empresaId', rutaEmpresaId);
    }
  }

  if (user && user.rolNombre === 'ASESOR') {
    if (action === 'create') {
      if (MODELOS_CON_ASESOR.has(modelo)) setKeyIfMissing(args, 'data.asesorId', user.sub);
      if (MODELOS_CON_EMPRESA.has(modelo) && modelo !== 'empresa') {
        if (!args?.data || typeof args.data !== 'object' || !(args.data as any).empresa) {
          setKeyIfMissing(args, 'data.empresaId', user.empresaId);
        }
      }
    } else if (action === 'createMany') {
      // omitido (no usado)
    } else if (tieneWhere && MODELOS_CON_ASESOR.has(modelo)) {
      if (action === 'upsert') {
        setKeyIfMissing(args, 'where.asesorId', user.sub);
        setKeyIfMissing(args, 'create.asesorId', user.sub);
        setKeyIfMissing(args, 'update.asesorId', user.sub);
      } else if (action === 'update') {
        setKeyIfMissing(args, 'where.asesorId', user.sub);
        setKeyIfMissing(args, 'data.asesorId', user.sub);
      } else if (action === 'updateMany') {
        setKeyIfMissing(args, 'where.asesorId', user.sub);
        setKeyIfMissing(args, 'data.asesorId', user.sub);
      } else if (action === 'delete' || action === 'deleteMany') {
        setKeyIfMissing(args, 'where.asesorId', user.sub);
      } else {
        setKeyIfMissing(args, 'where.asesorId', user.sub);
      }
    }
  }
}

const MODEL_DELEGATES = [
  'empresa', 'rol', 'usuario', 'proyecto', 'etapaPipeline',
  'cliente', 'propiedad', 'pipelineComercial', 'seguimientoAgenda',
  'visitaPropiedad', 'reserva', 'venta', 'pago', 'contratoPlantilla',
  'contrato', 'documento', 'comision', 'notificacion',
];

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly #base: TPrismaClient;
  readonly #scoped: PrismaExtended;

  declare readonly cliente: PrismaExtended['cliente'];
  declare readonly propiedad: PrismaExtended['propiedad'];
  declare readonly pipelineComercial: PrismaExtended['pipelineComercial'];
  declare readonly seguimientoAgenda: PrismaExtended['seguimientoAgenda'];
  declare readonly visitaPropiedad: PrismaExtended['visitaPropiedad'];
  declare readonly reserva: PrismaExtended['reserva'];
  declare readonly venta: PrismaExtended['venta'];
  declare readonly pago: PrismaExtended['pago'];
  declare readonly contratoPlantilla: PrismaExtended['contratoPlantilla'];
  declare readonly contrato: PrismaExtended['contrato'];
  declare readonly documento: PrismaExtended['documento'];
  declare readonly comision: PrismaExtended['comision'];
  declare readonly notificacion: PrismaExtended['notificacion'];
  declare readonly empresa: PrismaExtended['empresa'];
  declare readonly rol: PrismaExtended['rol'];
  declare readonly usuario: PrismaExtended['usuario'];
  declare readonly proyecto: PrismaExtended['proyecto'];
  declare readonly etapaPipeline: PrismaExtended['etapaPipeline'];

  constructor(configService: ConfigService) {
    const databaseUrl = configService.get<string>('DATABASE_URL') ?? process.env.DATABASE_URL ?? '';
    const pool = new Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(pool);
    this.#base = new (PrismaClient as any)({ adapter }) as TPrismaClient;
    this.#scoped = this.#base.$extends({
      query: {
        $allModels: {
          async $allOperations(params: any) {
            const scope = getScopeOrNull();
            const modelo: string = params.model ? String(params.model).charAt(0).toLowerCase() + String(params.model).slice(1) : '';
            const action: string = params.operation ?? '';
            const args = params.args ?? {};
            aplicarScope(scope?.user, scope?.rutaEmpresaId, modelo, args, action);
            params.args = args;
            const result = await params.query(params.args);
            if (scope?.user && scope.user.rolNombre === 'ASESOR' && modelo) {
              const isList = action === 'findMany' || action === 'groupBy';
              return aplicarFiltroOwn(scope.user, modelo, result, isList);
            }
            return result;
          },
        },
      },
    }) as PrismaExtended;

    for (const modelName of MODEL_DELEGATES) {
      Object.defineProperty(this, modelName, {
        get: () => (this.#scoped as any)[modelName],
        enumerable: true,
        configurable: true,
      });
    }
  }

  $connect(): Promise<void> { return this.#scoped.$connect(); }
  $disconnect(): Promise<void> { return this.#scoped.$disconnect(); }

  $transaction(input: any, options?: any): Promise<any> {
    return (this.#scoped as any).$transaction(input, options);
  }

  $extends(...args: any[]): any { return (this.#scoped as any).$extends(...args); }
  $on(...args: any[]): any { return (this.#base as any).$on(...args); }

  $queryRaw<T = any>(...args: any[]): Promise<T> { return (this.#scoped as any).$queryRaw(...args); }
  $queryRawUnsafe<T = any>(...args: any[]): Promise<T> { return (this.#scoped as any).$queryRawUnsafe(...args); }

  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}

export type { Prisma };
