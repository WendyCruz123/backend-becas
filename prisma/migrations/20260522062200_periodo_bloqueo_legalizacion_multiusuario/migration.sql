-- CreateEnum
CREATE TYPE "PeriodoBloqueo" AS ENUM ('ANUAL', 'SEMESTRAL');

-- CreateEnum
CREATE TYPE "EstadoLegalizacion" AS ENUM ('PENDIENTE_LEGALIZACION', 'EN_REVISION', 'LEGALIZADO', 'RECHAZADO', 'ENTREGADO');

-- AlterTable
ALTER TABLE "beca" ADD COLUMN     "periodo_bloqueo" "PeriodoBloqueo" NOT NULL DEFAULT 'ANUAL';

-- AlterTable
ALTER TABLE "postulacion" ADD COLUMN     "periodo_postulacion" TEXT;

-- AlterTable
ALTER TABLE "requisito" ADD COLUMN     "entrega_final_usuarioId" INTEGER;

-- CreateTable
CREATE TABLE "requisito_legalizacion_flujo" (
    "id" SERIAL NOT NULL,
    "requisitoId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requisito_legalizacion_flujo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paso_legalizacion_estudiante" (
    "id" SERIAL NOT NULL,
    "pasoEstudianteId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "estado" "EstadoLegalizacion" NOT NULL DEFAULT 'PENDIENTE_LEGALIZACION',
    "activo_revision" BOOLEAN NOT NULL DEFAULT false,
    "es_entrega_final" BOOLEAN NOT NULL DEFAULT false,
    "fecha_inicio" TIMESTAMP(3),
    "fecha_revision" TIMESTAMP(3),
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paso_legalizacion_estudiante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requisito_legalizacion_flujo_requisitoId_idx" ON "requisito_legalizacion_flujo"("requisitoId");

-- CreateIndex
CREATE INDEX "requisito_legalizacion_flujo_usuarioId_idx" ON "requisito_legalizacion_flujo"("usuarioId");

-- CreateIndex
CREATE INDEX "requisito_legalizacion_flujo_activo_idx" ON "requisito_legalizacion_flujo"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "requisito_legalizacion_flujo_requisitoId_orden_key" ON "requisito_legalizacion_flujo"("requisitoId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "requisito_legalizacion_flujo_requisitoId_usuarioId_key" ON "requisito_legalizacion_flujo"("requisitoId", "usuarioId");

-- CreateIndex
CREATE INDEX "paso_legalizacion_estudiante_pasoEstudianteId_idx" ON "paso_legalizacion_estudiante"("pasoEstudianteId");

-- CreateIndex
CREATE INDEX "paso_legalizacion_estudiante_usuarioId_idx" ON "paso_legalizacion_estudiante"("usuarioId");

-- CreateIndex
CREATE INDEX "paso_legalizacion_estudiante_estado_idx" ON "paso_legalizacion_estudiante"("estado");

-- CreateIndex
CREATE INDEX "paso_legalizacion_estudiante_activo_revision_idx" ON "paso_legalizacion_estudiante"("activo_revision");

-- CreateIndex
CREATE INDEX "paso_legalizacion_estudiante_es_entrega_final_idx" ON "paso_legalizacion_estudiante"("es_entrega_final");

-- CreateIndex
CREATE UNIQUE INDEX "paso_legalizacion_estudiante_pasoEstudianteId_orden_key" ON "paso_legalizacion_estudiante"("pasoEstudianteId", "orden");

-- CreateIndex
CREATE INDEX "postulacion_estudianteId_gestion_periodo_postulacion_estado_idx" ON "postulacion"("estudianteId", "gestion", "periodo_postulacion", "estado");

-- CreateIndex
CREATE INDEX "requisito_entrega_final_usuarioId_idx" ON "requisito"("entrega_final_usuarioId");

-- AddForeignKey
ALTER TABLE "requisito" ADD CONSTRAINT "requisito_entrega_final_usuarioId_fkey" FOREIGN KEY ("entrega_final_usuarioId") REFERENCES "usuario"("ID_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisito_legalizacion_flujo" ADD CONSTRAINT "requisito_legalizacion_flujo_requisitoId_fkey" FOREIGN KEY ("requisitoId") REFERENCES "requisito"("ID_paso") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisito_legalizacion_flujo" ADD CONSTRAINT "requisito_legalizacion_flujo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("ID_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paso_legalizacion_estudiante" ADD CONSTRAINT "paso_legalizacion_estudiante_pasoEstudianteId_fkey" FOREIGN KEY ("pasoEstudianteId") REFERENCES "paso_estudiante"("ID_paso_estudiante") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paso_legalizacion_estudiante" ADD CONSTRAINT "paso_legalizacion_estudiante_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("ID_usuario") ON DELETE CASCADE ON UPDATE CASCADE;
