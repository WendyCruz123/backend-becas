/*
  Warnings:

  - You are about to drop the column `familiar` on the `estudiante` table. All the data in the column will be lost.
  - You are about to drop the column `funcionario_publico` on the `estudiante` table. All the data in the column will be lost.
  - You are about to drop the column `ru` on the `persona` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "estudiante" DROP COLUMN "familiar",
DROP COLUMN "funcionario_publico",
ADD COLUMN     "ru" INTEGER;

-- AlterTable
ALTER TABLE "paso_estudiante" ADD COLUMN     "estado_revision" TEXT NOT NULL DEFAULT 'NO_REQUIERE',
ADD COLUMN     "fecha_revision" TIMESTAMP(3),
ADD COLUMN     "observacion_revision" TEXT;

-- AlterTable
ALTER TABLE "persona" DROP COLUMN "ru",
ALTER COLUMN "apellido_paterno" DROP NOT NULL,
ALTER COLUMN "apellido_materno" DROP NOT NULL,
ALTER COLUMN "direccion" DROP NOT NULL,
ALTER COLUMN "fecha_nacimiento" DROP NOT NULL;

-- AlterTable
ALTER TABLE "requisito" ADD COLUMN     "requiere_legalizacion" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "NotificacionSistema" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'INFO',
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificacionSistema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificacionSistema_userId_leido_createdAt_idx" ON "NotificacionSistema"("userId", "leido", "createdAt");

-- CreateIndex
CREATE INDEX "paso_estudiante_estado_revision_idx" ON "paso_estudiante"("estado_revision");

-- AddForeignKey
ALTER TABLE "NotificacionSistema" ADD CONSTRAINT "NotificacionSistema_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuario"("ID_usuario") ON DELETE CASCADE ON UPDATE CASCADE;
