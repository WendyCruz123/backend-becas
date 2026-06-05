/*
  Warnings:

  - A unique constraint covering the columns `[personaId]` on the table `estudiante` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "estudiante_personaId_key" ON "public"."estudiante"("personaId");
