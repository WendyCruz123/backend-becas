-- AlterTable
ALTER TABLE "postulacion" ADD COLUMN     "archivado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "beca_fecha_fin_historico" TIMESTAMP(3),
ADD COLUMN     "beca_fecha_inicio_historico" TIMESTAMP(3),
ADD COLUMN     "beca_nombre_historico" TEXT,
ADD COLUMN     "beca_tipo_historico" TEXT,
ADD COLUMN     "fecha_archivado" TIMESTAMP(3),
ADD COLUMN     "observacion_archivado" TEXT,
ALTER COLUMN "estado_observacion" SET DEFAULT 'NO OBSERVADO';

-- CreateIndex
CREATE INDEX "postulacion_archivado_idx" ON "postulacion"("archivado");
