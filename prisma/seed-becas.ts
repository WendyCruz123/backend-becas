import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const filePath = path.join(__dirname, 'becas_prisma.json');

  const raw = fs.readFileSync(filePath, 'utf-8');
  const becas = JSON.parse(raw);

  console.log(`📦 Becas encontradas: ${becas.length}`);

  let insertadas = 0;

  for (const item of becas) {
    try {
      const existente = await prisma.beca.findFirst({
        where: {
          nombre: item.nombre,
        },
      });

      if (existente) {
        console.log(`⚠️ Ya existe: ${item.nombre}`);
        continue;
      }

      await prisma.beca.create({
        data: {
          nombre: item.nombre,
          detalle: item.detalle || null,
          imagen: null,
          tipo: item.tipo,
          estado: true,
          fecha_inicio: new Date(item.fecha_inicio),
          fecha_fin: item.fecha_fin
            ? new Date(item.fecha_fin)
            : null,
        },
      });

      insertadas++;

      console.log(`✅ Insertada: ${item.nombre}`);
    } catch (error) {
      console.error(`❌ Error con beca ${item.nombre}:`, error);
    }
  }

  console.log('--------------------------------');
  console.log(`✅ Total insertadas: ${insertadas}`);
  console.log('🚀 Importación finalizada');
}

main()
  .catch((error) => {
    console.error(error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });