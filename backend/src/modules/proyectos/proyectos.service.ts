import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

@Injectable()
export class ProyectosService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(empresaId: string) {
    return this.prisma.proyecto.findMany({
      where: {
        empresaId,
        active: true,
        deletedAt: null,
      },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        tipoProyecto: true,
        estado: true,
      },
    });
  }
}
