/*
  Warnings:

  - You are about to drop the column `personaId` on the `encargado_oficina` table. All the data in the column will be lost.
  - Added the required column `apellido_materno` to the `encargado_oficina` table without a default value. This is not possible if the table is not empty.
  - Added the required column `apellido_paterno` to the `encargado_oficina` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nombre` to the `encargado_oficina` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."encargado_oficina" DROP CONSTRAINT "encargado_oficina_personaId_fkey";

-- AlterTable
ALTER TABLE "public"."encargado_oficina" DROP COLUMN "personaId",
ADD COLUMN     "apellido_materno" TEXT NOT NULL,
ADD COLUMN     "apellido_paterno" TEXT NOT NULL,
ADD COLUMN     "celular" TEXT,
ADD COLUMN     "correo_electronico" TEXT,
ADD COLUMN     "nombre" TEXT NOT NULL;
