import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type { CreateCampanaDto, FindCampanasQueryDto } from './dto/campanas.dto';
import type { UpdateCampanaDto } from './dto/update-campana.dto';

@Injectable()
export class CampanasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(empresaId: string, dto: FindCampanasQueryDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {
      empresaId,
      active: true,
      deletedAt: null,
      ...(dto.plataforma ? { plataforma: dto.plataforma } : {}),
      ...(dto.buscar
        ? {
            OR: [
              { nombreCampana: { contains: dto.buscar, mode: 'insensitive' } },
              { campaignId: { contains: dto.buscar } },
              { adId: { contains: dto.buscar } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.campana.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { _count: { select: { clientes: true, conversaciones: true } } },
      }),
      this.prisma.campana.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async findOne(empresaId: string, id: string) {
    const campana = await this.prisma.campana.findFirst({
      where: { id, empresaId, active: true, deletedAt: null },
      include: { _count: { select: { clientes: true, conversaciones: true } } },
    });
    if (!campana) throw new NotFoundException('Campaña no encontrada.');
    return campana;
  }

  create(empresaId: string, dto: CreateCampanaDto) {
    return this.prisma.campana.create({
      data: {
        empresaId,
        nombreCampana: dto.nombreCampana,
        plataforma: dto.plataforma,
        campaignId: dto.campaignId ?? null,
        adsetId: dto.adsetId ?? null,
        adId: dto.adId ?? null,
        proyectoIds: dto.proyectoIds ?? [],
        propiedadIds: dto.propiedadIds ?? [],
        fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : null,
        fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null,
        observaciones: dto.observaciones ?? null,
      },
    });
  }

  async update(empresaId: string, id: string, dto: UpdateCampanaDto) {
    await this.findOne(empresaId, id);
    return this.prisma.campana.update({
      where: { id },
      data: {
        ...(dto.nombreCampana !== undefined ? { nombreCampana: dto.nombreCampana } : {}),
        ...(dto.plataforma !== undefined ? { plataforma: dto.plataforma } : {}),
        ...(dto.campaignId !== undefined ? { campaignId: dto.campaignId } : {}),
        ...(dto.adsetId !== undefined ? { adsetId: dto.adsetId } : {}),
        ...(dto.adId !== undefined ? { adId: dto.adId } : {}),
        ...(dto.proyectoIds !== undefined ? { proyectoIds: dto.proyectoIds } : {}),
        ...(dto.propiedadIds !== undefined ? { propiedadIds: dto.propiedadIds } : {}),
        ...(dto.fechaInicio !== undefined ? { fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : null } : {}),
        ...(dto.fechaFin !== undefined ? { fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null } : {}),
        ...(dto.observaciones !== undefined ? { observaciones: dto.observaciones } : {}),
      },
    });
  }

  async remove(empresaId: string, id: string) {
    await this.findOne(empresaId, id);
    return this.prisma.campana.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
  }
}
