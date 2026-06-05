/*
  Warnings:

  - You are about to drop the column `descripcion` on the `beca` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "beca" DROP COLUMN "descripcion",
ADD COLUMN     "detalle" TEXT,
ADD COLUMN     "imagen" TEXT;
