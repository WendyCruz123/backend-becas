/*
  Warnings:

  - The `estado` column on the `postulacion` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "public"."postulacion" ADD COLUMN     "estado_final" TEXT NOT NULL DEFAULT 'pendiente',
ADD COLUMN     "estado_observacion" TEXT NOT NULL DEFAULT 'sin observacion',
ADD COLUMN     "observacion" TEXT,
DROP COLUMN "estado",
ADD COLUMN     "estado" TEXT NOT NULL DEFAULT 'EN_PROCESO';

-- DropEnum
DROP TYPE "public"."EstadoPostulacion";

-- CreateIndex
CREATE INDEX "postulacion_estudianteId_gestion_estado_idx" ON "public"."postulacion"("estudianteId", "gestion", "estado");
