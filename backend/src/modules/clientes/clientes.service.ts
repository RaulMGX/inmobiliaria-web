import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../infrastructure/database/prisma/generated/client';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { FindClientesQueryDto } from './dto/find-clientes.query.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

type ClienteConProyectos = Record<string, any> & {
  proyectos: { proyecto: { id: string; nombre: string } }[];
};

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(empresaId: string, dto: CreateClienteDto) {
    this.validateBusinessRules(dto);
    await this.ensureDocumentoDisponible(
      empresaId,
      dto.tipoDocumento,
      dto.numeroDocumento,
    );
    await this.ensureProyectosDisponibles(empresaId, dto.proyectoIds);

    try {
      const cliente = await this.prisma.cliente.create({
        data: this.buildCreateData(empresaId, dto),
      });
      await this.syncProyectos(cliente.id, dto.proyectoIds);
      return await this.findOne(empresaId, cliente.id);
    } catch (error: any) {
      this.handlePrismaError(error);
    }
  }

  async findAll(empresaId: string, query: FindClientesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = this.buildFindWhere(empresaId, query);
    const orderBy = this.buildOrderBy(query);

    const [clientes, total] = (await this.prisma.$transaction([
      this.prisma.cliente.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: this.proyectosInclude(),
      }),
      this.prisma.cliente.count({ where }),
    ])) as [ClienteConProyectos[], number];

    return {
      data: clientes.map((cliente) => this.mapCliente(cliente)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOne(empresaId: string, id: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: {
        id,
        empresaId,
        active: true,
        deletedAt: null,
      },
      include: this.proyectosInclude(),
    });

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado para la empresa indicada.');
    }

    return this.mapCliente(cliente);
  }

  async update(empresaId: string, id: string, dto: UpdateClienteDto) {
    this.validateBusinessRules(dto);
    await this.findOne(empresaId, id);

    await this.ensureDocumentoDisponible(
      empresaId,
      dto.tipoDocumento,
      dto.numeroDocumento,
      id,
    );

    if (dto.proyectoIds !== undefined) {
      await this.ensureProyectosDisponibles(empresaId, dto.proyectoIds);
    }

    try {
      await this.prisma.cliente.update({
        where: { id },
        data: this.buildUpdateData(dto),
      });
      await this.syncProyectos(id, dto.proyectoIds);
      return await this.findOne(empresaId, id);
    } catch (error: any) {
      this.handlePrismaError(error);
    }
  }

  async remove(empresaId: string, id: string) {
    await this.findOne(empresaId, id);

    return this.prisma.cliente.update({
      where: { id },
      data: {
        active: false,
        deletedAt: new Date(),
      },
    });
  }

  private buildFindWhere(
    empresaId: string,
    query: FindClientesQueryDto,
  ): Prisma.ClienteWhereInput {
    const search = query.search?.trim();
    const searchTerms = search?.split(/\s+/).filter(Boolean) ?? [];
    const containsInsensitive = (value: string): Prisma.StringFilter<'Cliente'> => ({
      contains: value,
      mode: 'insensitive',
    });

    const nameConditions: Prisma.ClienteWhereInput[] =
      searchTerms.length > 0
        ? [
            {
              AND: searchTerms.map(
                (term): Prisma.ClienteWhereInput => ({
                  OR: [
                    { nombres: containsInsensitive(term) },
                    { apellidos: containsInsensitive(term) },
                  ],
                }),
              ),
            },
          ]
        : [];

    return {
      empresaId,
      active: true,
      deletedAt: null,
      ...(query.estado ? { estado: query.estado as any } : {}),
      ...(search
        ? {
            OR: <Prisma.ClienteWhereInput[]>[
              { nombres: containsInsensitive(search) },
              { apellidos: containsInsensitive(search) },
              { numeroDocumento: containsInsensitive(search) },
              { correo: containsInsensitive(search) },
              { celular: containsInsensitive(search) },
              ...nameConditions,
            ],
          }
        : {}),
    };
  }

  private buildOrderBy(query: FindClientesQueryDto): Prisma.ClienteOrderByWithRelationInput {
    const direction = query.sortDirection ?? 'desc';
    const sortBy = query.sortBy ?? 'createdAt';

    return { [sortBy]: direction };
  }

  private buildCreateData(
    empresaId: string,
    dto: CreateClienteDto,
  ): Prisma.ClienteCreateInput {
    return {
      ...this.normalizeClientePayload(dto),
      empresaId,
    } as unknown as Prisma.ClienteCreateInput;
  }

  private buildUpdateData(dto: UpdateClienteDto): Prisma.ClienteUpdateInput {
    return this.normalizeClientePayload(dto) as unknown as Prisma.ClienteUpdateInput;
  }

  private proyectosInclude() {
    return {
      proyectos: {
        select: {
          proyecto: { select: { id: true, nombre: true } },
        },
      },
    } satisfies Prisma.ClienteInclude;
  }

  private mapCliente<
    T extends { proyectos: { proyecto: { id: string; nombre: string } }[] },
  >(cliente: T) {
    const { proyectos, ...rest } = cliente;

    return {
      ...rest,
      proyectos: proyectos.map((item) => item.proyecto),
    };
  }

  private normalizeProyectoIds(proyectoIds?: string[]) {
    return Array.from(
      new Set(
        (proyectoIds ?? [])
          .map((id) => id?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    );
  }

  private async ensureProyectosDisponibles(
    empresaId: string,
    proyectoIds?: string[],
  ) {
    const ids = this.normalizeProyectoIds(proyectoIds);

    if (ids.length === 0) {
      throw new BadRequestException('Debes seleccionar al menos un proyecto.');
    }

    const proyectos = await this.prisma.proyecto.findMany({
      where: {
        id: { in: ids },
        empresaId,
        active: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (proyectos.length !== ids.length) {
      throw new BadRequestException(
        'Uno o más proyectos no existen o no pertenecen a la empresa.',
      );
    }
  }

  private async syncProyectos(clienteId: string, proyectoIds?: string[]) {
    if (proyectoIds === undefined) {
      return;
    }

    const ids = this.normalizeProyectoIds(proyectoIds);

    await this.prisma.$transaction([
      this.prisma.clienteProyecto.deleteMany({ where: { clienteId } }),
      this.prisma.clienteProyecto.createMany({
        data: ids.map((proyectoId) => ({ clienteId, proyectoId })),
        skipDuplicates: true,
      }),
    ]);
  }

  private normalizeClientePayload(dto: Partial<CreateClienteDto>) {
    return {
      ...(dto.nombres !== undefined ? { nombres: dto.nombres.trim() } : {}),
      ...(dto.apellidos !== undefined ? { apellidos: dto.apellidos.trim() } : {}),
      ...(dto.tipoDocumento !== undefined ? { tipoDocumento: dto.tipoDocumento } : {}),
      ...(dto.numeroDocumento !== undefined
        ? { numeroDocumento: dto.numeroDocumento?.trim() || null }
        : {}),
      ...(dto.celular !== undefined ? { celular: dto.celular.trim() } : {}),
      ...(dto.telefono !== undefined ? { telefono: dto.telefono?.trim() || null } : {}),
      ...(dto.correo !== undefined
        ? { correo: dto.correo?.trim().toLowerCase() || null }
        : {}),
      ...(dto.fechaNacimiento !== undefined
        ? { fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : null }
        : {}),
      ...(dto.estadoCivil !== undefined ? { estadoCivil: dto.estadoCivil } : {}),
      ...(dto.ocupacion !== undefined ? { ocupacion: dto.ocupacion?.trim() || null } : {}),
      ...(dto.empresaDondeTrabaja !== undefined
        ? { empresaDondeTrabaja: dto.empresaDondeTrabaja?.trim() || null }
        : {}),
      ...(dto.distrito !== undefined ? { distrito: dto.distrito?.trim() || null } : {}),
      ...(dto.ciudad !== undefined ? { ciudad: dto.ciudad?.trim() || null } : {}),
      ...(dto.direccion !== undefined ? { direccion: dto.direccion?.trim() || null } : {}),
      ...(dto.presupuestoMinimo !== undefined
        ? { presupuestoMinimo: dto.presupuestoMinimo }
        : {}),
      ...(dto.presupuestoMaximo !== undefined
        ? { presupuestoMaximo: dto.presupuestoMaximo }
        : {}),
      ...(dto.moneda !== undefined ? { moneda: dto.moneda } : {}),
      ...(dto.medioCaptacion !== undefined ? { medioCaptacion: dto.medioCaptacion } : {}),
      ...(dto.estado !== undefined ? { estado: dto.estado } : {}),
      ...(dto.observaciones !== undefined
        ? { observaciones: dto.observaciones?.trim() || null }
        : {}),
      // Perfil de compra (nuevos campos)
      ...(dto.tipoPropiedadInteres !== undefined
        ? { tipoPropiedadInteres: dto.tipoPropiedadInteres || null }
        : {}),
      ...(dto.propiedadInteresDetalle !== undefined
        ? { propiedadInteresDetalle: dto.propiedadInteresDetalle?.trim() || null }
        : {}),
      ...(dto.motivoCompra !== undefined
        ? { motivoCompra: dto.motivoCompra || null }
        : {}),
      ...(dto.metodoPagoPreferido !== undefined
        ? { metodoPagoPreferido: dto.metodoPagoPreferido || null }
        : {}),
      ...(dto.bancoPreferencia !== undefined
        ? { bancoPreferencia: dto.bancoPreferencia?.trim() || null }
        : {}),
      ...(dto.preAprobacionDetalle !== undefined
        ? { preAprobacionDetalle: dto.preAprobacionDetalle?.trim() || null }
        : {}),
      ...(dto.urgenciaCompra !== undefined
        ? { urgenciaCompra: dto.urgenciaCompra || null }
        : {}),
    };
  }

  private validateBusinessRules(dto: Partial<CreateClienteDto>) {
    const hasTipoDocumento = dto.tipoDocumento !== undefined;
    const hasNumeroDocumento = dto.numeroDocumento !== undefined;

    if (hasTipoDocumento !== hasNumeroDocumento) {
      throw new BadRequestException(
        'tipoDocumento y numeroDocumento deben enviarse juntos.',
      );
    }

    if (
      dto.presupuestoMinimo !== undefined &&
      dto.presupuestoMaximo !== undefined &&
      dto.presupuestoMinimo > dto.presupuestoMaximo
    ) {
      throw new BadRequestException(
        'presupuestoMinimo no puede ser mayor que presupuestoMaximo.',
      );
    }

    if (
      (dto.presupuestoMinimo !== undefined || dto.presupuestoMaximo !== undefined) &&
      dto.moneda === undefined
    ) {
      throw new BadRequestException(
        'Debe indicar la moneda cuando registra presupuesto.',
      );
    }
  }

  private async ensureDocumentoDisponible(
    empresaId: string,
    tipoDocumento?: string,
    numeroDocumento?: string,
    excludeId?: string,
  ) {
    if (!tipoDocumento || !numeroDocumento) {
      return;
    }

    const existing = await this.prisma.cliente.findFirst({
      where: {
        empresaId,
        tipoDocumento: tipoDocumento as any,
        numeroDocumento,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, active: true, deletedAt: true },
    });

    if (existing?.active && !existing.deletedAt) {
      throw new ConflictException(
        'Ya existe un cliente activo con ese tipo y número de documento en la empresa.',
      );
    }

    if (existing?.deletedAt) {
      throw new ConflictException(
        'Ya existe un cliente eliminado con ese documento; la restricción actual no permite reutilizarlo.',
      );
    }
  }

  private handlePrismaError(error: any): never {
    if (error?.code === 'P2002') {
      throw new ConflictException(
        'No se pudo completar la operación por una restricción de unicidad.',
      );
    }

    throw error;
  }
}
