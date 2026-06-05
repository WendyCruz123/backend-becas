/*
  Warnings:

  - A unique constraint covering the columns `[correo_electronico]` on the table `persona` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "persona_correo_electronico_key" ON "public"."persona"("correo_electronico");
