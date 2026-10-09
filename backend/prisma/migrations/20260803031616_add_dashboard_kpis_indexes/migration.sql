-- CreateIndex
CREATE INDEX "clientes_empresa_id_created_at_idx" ON "clientes"("empresa_id", "created_at");

-- CreateIndex
CREATE INDEX "pipelines_comerciales_empresa_id_fecha_ingreso_idx" ON "pipelines_comerciales"("empresa_id", "fecha_ingreso");
