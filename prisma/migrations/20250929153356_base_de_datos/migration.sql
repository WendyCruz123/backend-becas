-- CreateEnum
CREATE TYPE "public"."HotspotType" AS ENUM ('INFORMACION', 'LINK');

-- CreateEnum
CREATE TYPE "public"."IconType" AS ENUM ('INFO', 'FLECHA');

-- CreateEnum
CREATE TYPE "public"."EstadoPostulacion" AS ENUM ('PENDIENTE', 'ACEPTADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "public"."hotspot" (
    "id" TEXT NOT NULL,
    "panoramaId" TEXT NOT NULL,
    "type" "public"."HotspotType" NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "z" DOUBLE PRECISION NOT NULL,
    "icon" "public"."IconType" NOT NULL DEFAULT 'INFO',
    "titulo" TEXT,
    "contenido" TEXT,
    "orden" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "es_entrada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "hotspot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."panorama" (
    "id" TEXT NOT NULL,
    "oficina_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "projection" TEXT DEFAULT 'equirectangular',
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "es_portada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "panorama_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."hotspotLink" (
    "id" TEXT NOT NULL,
    "hotspotId" TEXT NOT NULL,
    "targetPanoramaId" TEXT NOT NULL,
    "transition" TEXT,

    CONSTRAINT "hotspotLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."beca" (
    "ID_beca" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" TEXT NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3),

    CONSTRAINT "beca_pkey" PRIMARY KEY ("ID_beca")
);

-- CreateTable
CREATE TABLE "public"."postulacion" (
    "ID_postulacion" TEXT NOT NULL,
    "estudianteId" INTEGER NOT NULL,
    "becaId" INTEGER NOT NULL,
    "gestion" TEXT NOT NULL,
    "estado" "public"."EstadoPostulacion" NOT NULL DEFAULT 'PENDIENTE',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "postulacion_pkey" PRIMARY KEY ("ID_postulacion")
);

-- CreateTable
CREATE TABLE "public"."requisito" (
    "ID_paso" SERIAL NOT NULL,
    "oficinaId" INTEGER,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "archivo_ejemplo_url" TEXT,
    "url_externa" TEXT,

    CONSTRAINT "requisito_pkey" PRIMARY KEY ("ID_paso")
);

-- CreateTable
CREATE TABLE "public"."pasosPorBeca" (
    "ID_pasosBeca" SERIAL NOT NULL,
    "becaId" INTEGER NOT NULL,
    "requisitoId" INTEGER NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "pasosPorBeca_pkey" PRIMARY KEY ("ID_pasosBeca")
);

-- CreateTable
CREATE TABLE "public"."paso_estudiante" (
    "ID_paso_estudiante" SERIAL NOT NULL,
    "postulacionId" TEXT NOT NULL,
    "pasoBecaId" INTEGER NOT NULL,
    "completado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_completado" TIMESTAMP(3),
    "notas" TEXT,

    CONSTRAINT "paso_estudiante_pkey" PRIMARY KEY ("ID_paso_estudiante")
);

-- CreateIndex
CREATE INDEX "hotspot_panoramaId_idx" ON "public"."hotspot"("panoramaId");

-- CreateIndex
CREATE INDEX "panorama_oficina_id_idx" ON "public"."panorama"("oficina_id");

-- CreateIndex
CREATE UNIQUE INDEX "panorama_oficina_id_orden_key" ON "public"."panorama"("oficina_id", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "hotspotLink_hotspotId_key" ON "public"."hotspotLink"("hotspotId");

-- CreateIndex
CREATE INDEX "postulacion_estudianteId_gestion_estado_idx" ON "public"."postulacion"("estudianteId", "gestion", "estado");

-- CreateIndex
CREATE INDEX "postulacion_becaId_gestion_idx" ON "public"."postulacion"("becaId", "gestion");

-- CreateIndex
CREATE UNIQUE INDEX "pasosPorBeca_becaId_requisitoId_key" ON "public"."pasosPorBeca"("becaId", "requisitoId");

-- CreateIndex
CREATE UNIQUE INDEX "pasosPorBeca_becaId_orden_key" ON "public"."pasosPorBeca"("becaId", "orden");

-- CreateIndex
CREATE INDEX "paso_estudiante_postulacionId_idx" ON "public"."paso_estudiante"("postulacionId");

-- CreateIndex
CREATE INDEX "paso_estudiante_pasoBecaId_idx" ON "public"."paso_estudiante"("pasoBecaId");

-- CreateIndex
CREATE UNIQUE INDEX "paso_estudiante_postulacionId_pasoBecaId_key" ON "public"."paso_estudiante"("postulacionId", "pasoBecaId");

-- AddForeignKey
ALTER TABLE "public"."hotspot" ADD CONSTRAINT "hotspot_panoramaId_fkey" FOREIGN KEY ("panoramaId") REFERENCES "public"."panorama"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."panorama" ADD CONSTRAINT "panorama_oficina_id_fkey" FOREIGN KEY ("oficina_id") REFERENCES "public"."oficina"("ID_oficina") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hotspotLink" ADD CONSTRAINT "hotspotLink_hotspotId_fkey" FOREIGN KEY ("hotspotId") REFERENCES "public"."hotspot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hotspotLink" ADD CONSTRAINT "hotspotLink_targetPanoramaId_fkey" FOREIGN KEY ("targetPanoramaId") REFERENCES "public"."panorama"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."postulacion" ADD CONSTRAINT "postulacion_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "public"."estudiante"("ID_estudiante") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."postulacion" ADD CONSTRAINT "postulacion_becaId_fkey" FOREIGN KEY ("becaId") REFERENCES "public"."beca"("ID_beca") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requisito" ADD CONSTRAINT "requisito_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "public"."oficina"("ID_oficina") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pasosPorBeca" ADD CONSTRAINT "pasosPorBeca_becaId_fkey" FOREIGN KEY ("becaId") REFERENCES "public"."beca"("ID_beca") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pasosPorBeca" ADD CONSTRAINT "pasosPorBeca_requisitoId_fkey" FOREIGN KEY ("requisitoId") REFERENCES "public"."requisito"("ID_paso") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."paso_estudiante" ADD CONSTRAINT "paso_estudiante_postulacionId_fkey" FOREIGN KEY ("postulacionId") REFERENCES "public"."postulacion"("ID_postulacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."paso_estudiante" ADD CONSTRAINT "paso_estudiante_pasoBecaId_fkey" FOREIGN KEY ("pasoBecaId") REFERENCES "public"."pasosPorBeca"("ID_pasosBeca") ON DELETE CASCADE ON UPDATE CASCADE;
