-- CreateEnum
CREATE TYPE "TipoPropiedad" AS ENUM ('CASA', 'DEPARTAMENTO', 'TERRENO', 'LOCAL', 'OFICINA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoPropiedad" AS ENUM ('DISPONIBLE', 'RESERVADO', 'VENDIDO', 'SEPARADO');

-- CreateTable
CREATE TABLE "propiedades" (
    "id" TEXT NOT NULL,
    "codigo_interno" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "tipo_propiedad" "TipoPropiedad" NOT NULL,
    "estado" "EstadoPropiedad" NOT NULL DEFAULT 'DISPONIBLE',
    "precio" DECIMAL(14,2) NOT NULL,
    "area_total" DECIMAL(10,2),
    "area_construida" DECIMAL(10,2),
    "habitaciones" INTEGER,
    "banos" INTEGER,
    "estacionamientos" INTEGER,
    "piso" INTEGER,
    "direccion" VARCHAR(255),
    "distrito" VARCHAR(100),
    "ciudad" VARCHAR(100),
    "latitud" DECIMAL(10,8),
    "longitud" DECIMAL(11,8),
    "descripcion" VARCHAR(1000),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "proyecto_id" TEXT NOT NULL,

    CONSTRAINT "propiedades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "propiedades_codigo_interno_key" ON "propiedades"("codigo_interno");

-- CreateIndex
CREATE INDEX "propiedades_proyecto_id_idx" ON "propiedades"("proyecto_id");

-- CreateIndex
CREATE INDEX "propiedades_estado_idx" ON "propiedades"("estado");

-- CreateIndex
CREATE INDEX "propiedades_active_idx" ON "propiedades"("active");

-- CreateIndex
CREATE INDEX "propiedades_deleted_at_idx" ON "propiedades"("deleted_at");

-- AddForeignKey
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
