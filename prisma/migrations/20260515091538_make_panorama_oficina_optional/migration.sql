-- DropForeignKey
ALTER TABLE "panorama" DROP CONSTRAINT "panorama_oficina_id_fkey";

-- AlterTable
ALTER TABLE "panorama" ALTER COLUMN "oficina_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "panorama" ADD CONSTRAINT "panorama_oficina_id_fkey" FOREIGN KEY ("oficina_id") REFERENCES "oficina"("ID_oficina") ON DELETE SET NULL ON UPDATE CASCADE;
