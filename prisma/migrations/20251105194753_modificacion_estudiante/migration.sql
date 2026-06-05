/*
  Warnings:

  - You are about to drop the column `estado_academico` on the `estudiante` table. All the data in the column will be lost.
  - You are about to drop the column `fecha_ingreso` on the `estudiante` table. All the data in the column will be lost.
  - You are about to drop the column `semestre_actual` on the `estudiante` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."estudiante" DROP COLUMN "estado_academico",
DROP COLUMN "fecha_ingreso",
DROP COLUMN "semestre_actual",
ADD COLUMN     "año_ingreso" INTEGER NOT NULL DEFAULT 2023,
ADD COLUMN     "familiar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "funcionario_publico" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "semestre" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."persona" ADD COLUMN     "ru" INTEGER;
