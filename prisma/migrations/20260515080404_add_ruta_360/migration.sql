-- AlterTable
ALTER TABLE "panorama" ADD COLUMN     "rutaId" TEXT;

-- CreateTable
CREATE TABLE "ruta_360" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ruta_360_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ruta_360_slug_key" ON "ruta_360"("slug");

-- AddForeignKey
ALTER TABLE "panorama" ADD CONSTRAINT "panorama_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "ruta_360"("id") ON DELETE SET NULL ON UPDATE CASCADE;
