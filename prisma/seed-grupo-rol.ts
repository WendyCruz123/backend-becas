import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const roles = [
  {
    nombre: 'estudiante',
    descripcion: 'Estudiante de la Carrera de Física',
  },
  {
    nombre: 'kardex',
    descripcion: 'Kardex de la Carrera de Física encargado de notificar',
  },
  {
    nombre: 'admin',
    descripcion: 'Administrador del sistema',
  },
  {
    nombre: 'encargado',
    descripcion: 'Encargado de evaluar etapas',
  },
];

async function main() {
  console.log('📌 Insertando roles base...');

  for (const rol of roles) {
    const existe = await prisma.grupo_rol.findFirst({
      where: {
        nombre: rol.nombre,
      },
    });

    if (existe) {
      await prisma.grupo_rol.update({
        where: {
          ID_grupo_rol: existe.ID_grupo_rol,
        },
        data: {
          descripcion: rol.descripcion,
        },
      });

      console.log(`🔄 Rol actualizado: ${rol.nombre}`);
    } else {
      await prisma.grupo_rol.create({
        data: rol,
      });

      console.log(`✅ Rol creado: ${rol.nombre}`);
    }
  }

  console.log('🚀 Roles base insertados correctamente.');
}

main()
  .catch((error) => {
    console.error('❌ Error insertando roles:', error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });