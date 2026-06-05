-- CreateIndex
CREATE INDEX "encargado_oficina_oficinaId_idx" ON "public"."encargado_oficina"("oficinaId");

-- CreateIndex
CREATE INDEX "encargado_oficina_estado_fecha_fin_idx" ON "public"."encargado_oficina"("estado", "fecha_fin");
