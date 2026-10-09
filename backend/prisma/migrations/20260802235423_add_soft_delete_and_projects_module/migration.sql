-- CreateEnum
CREATE TYPE "TipoProyecto" AS ENUM ('CASAS', 'DEPARTAMENTOS');

-- CreateEnum
CREATE TYPE "EstadoProyecto" AS ENUM ('ACTIVO', 'FINALIZADO', 'PAUSADO');

-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "avatar" VARCHAR(255),
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "last_login" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "proyectos" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" VARCHAR(500),
    "tipo_proyecto" "TipoProyecto" NOT NULL,
    "estado" "EstadoProyecto" NOT NULL DEFAULT 'ACTIVO',
    "fecha_inicio" DATE,
    "fecha_fin" DATE,
    "direccion" VARCHAR(255),
    "distrito" VARCHAR(100),
    "ciudad" VARCHAR(100),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "empresa_id" TEXT NOT NULL,

    CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proyectos_empresa_id_idx" ON "proyectos"("empresa_id");

-- CreateIndex
CREATE INDEX "proyectos_estado_idx" ON "proyectos"("estado");

-- CreateIndex
CREATE INDEX "proyectos_active_idx" ON "proyectos"("active");

-- CreateIndex
CREATE INDEX "proyectos_deleted_at_idx" ON "proyectos"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "proyectos_empresa_id_nombre_key" ON "proyectos"("empresa_id", "nombre");

-- CreateIndex
CREATE INDEX "empresas_deleted_at_idx" ON "empresas"("deleted_at");

-- CreateIndex
CREATE INDEX "roles_deleted_at_idx" ON "roles"("deleted_at");

-- CreateIndex
CREATE INDEX "usuarios_deleted_at_idx" ON "usuarios"("deleted_at");

-- CreateIndex
CREATE INDEX "usuarios_last_login_idx" ON "usuarios"("last_login");

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
