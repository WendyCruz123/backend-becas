/*
  Warnings:

  - A unique constraint covering the columns `[codigo_seguimiento]` on the table `postulacion` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "pasosPorBeca_becaId_orden_key";

-- AlterTable
ALTER TABLE "paso_estudiante" ADD COLUMN     "descripcion_etapa" TEXT,
ADD COLUMN     "estado_etapa" TEXT DEFAULT 'BLOQUEADO',
ADD COLUMN     "fecha_etapa" TIMESTAMP(3),
ADD COLUMN     "nota_etapa" DOUBLE PRECISION,
ADD COLUMN     "oficinaRutaId" INTEGER,
ADD COLUMN     "texto_extra_etapa" TEXT;

-- AlterTable
ALTER TABLE "pasosPorBeca" ALTER COLUMN "orden" DROP NOT NULL;

-- AlterTable
ALTER TABLE "postulacion" ADD COLUMN     "codigo_seguimiento" TEXT;

-- AlterTable
ALTER TABLE "requisito" ADD COLUMN     "requiere_fecha_descripcion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiere_nota" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiere_otro" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiere_ruta_360" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tipo_requisito" TEXT NOT NULL DEFAULT 'DOCUMENTO';

-- CreateTable
CREATE TABLE "requisito_encargado" (
    "ID_requisito_encargado" SERIAL NOT NULL,
    "requisitoId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "requisito_encargado_pkey" PRIMARY KEY ("ID_requisito_encargado")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "tabla" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "detalle" TEXT,
    "antes" JSONB,
    "despues" JSONB,
    "usuarioId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "requisito_encargado_requisitoId_usuarioId_key" ON "requisito_encargado"("requisitoId", "usuarioId");

-- CreateIndex
CREATE INDEX "audit_log_tabla_registroId_idx" ON "audit_log"("tabla", "registroId");

-- CreateIndex
CREATE INDEX "audit_log_usuarioId_idx" ON "audit_log"("usuarioId");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- CreateIndex
CREATE INDEX "pasosPorBeca_becaId_orden_idx" ON "pasosPorBeca"("becaId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "postulacion_codigo_seguimiento_key" ON "postulacion"("codigo_seguimiento");

-- AddForeignKey
ALTER TABLE "requisito_encargado" ADD CONSTRAINT "requisito_encargado_requisitoId_fkey" FOREIGN KEY ("requisitoId") REFERENCES "requisito"("ID_paso") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisito_encargado" ADD CONSTRAINT "requisito_encargado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("ID_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paso_estudiante" ADD CONSTRAINT "paso_estudiante_oficinaRutaId_fkey" FOREIGN KEY ("oficinaRutaId") REFERENCES "oficina"("ID_oficina") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("ID_usuario") ON DELETE SET NULL ON UPDATE CASCADE;
