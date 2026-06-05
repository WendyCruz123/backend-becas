-- DropIndex
DROP INDEX "postulacion_archivado_idx";

-- AlterTable
ALTER TABLE "postulacion" ADD COLUMN     "abandono_recuperable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "estado_antes_abandono" TEXT,
ADD COLUMN     "fecha_abandono" TIMESTAMP(3),
ADD COLUMN     "motivo_abandono" TEXT;

-- CreateIndex
CREATE INDEX "paso_estudiante_estado_etapa_idx" ON "paso_estudiante"("estado_etapa");

-- CreateIndex
CREATE INDEX "postulacion_estado_idx" ON "postulacion"("estado");

-- CreateIndex
CREATE INDEX "postulacion_abandono_recuperable_idx" ON "postulacion"("abandono_recuperable");
