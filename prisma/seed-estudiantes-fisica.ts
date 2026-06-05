import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function limpiarTexto(value: any, fallback = '') {
  return String(value ?? fallback).trim();
}

function limpiarCorreo(value: any, ci: string) {
  const correo = String(value ?? '').trim().toLowerCase();

  if (correo && correo.includes('@')) return correo;

  return `estudiante.${ci}@fisica.upea.bo`;
}

async function main() {
  const filePath = path.join(__dirname, 'estudiantes_fisica_prisma.json');

  const raw = fs.readFileSync(filePath, 'utf-8');
  const estudiantes = JSON.parse(raw);

  console.log(`📦 Registros encontrados: ${estudiantes.length}`);

  let importados = 0;
  let saltados = 0;

  for (const item of estudiantes) {
    const p = item.persona ?? item;
    const e = item.estudiante ?? item;

    const ci = limpiarTexto(p.ci);

    if (!ci) {
      console.log('⚠️ Registro saltado porque no tiene CI:', item);
      saltados++;
      continue;
    }

    const correo = limpiarCorreo(p.correo_electronico, ci);
    const plainPassword = `${ci}#cfea`;
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    try {
      const persona = await prisma.persona.upsert({
        where: { ci },
        update: {
          expedido: limpiarTexto(p.expedido, 'LP'),
          nombre: limpiarTexto(p.nombre, 'SIN NOMBRE'),
          apellido_paterno: limpiarTexto(p.apellido_paterno) || null,
          apellido_materno: limpiarTexto(p.apellido_materno) || null,
          apellido_casado: limpiarTexto(p.apellido_casado) || null,
          genero: limpiarTexto(p.genero, 'NO ESPECIFICADO'),
          direccion: limpiarTexto(p.direccion) || null,
          correo_electronico: correo,
          celular: limpiarTexto(p.celular, '00000000'),
          fecha_nacimiento: p.fecha_nacimiento
            ? new Date(p.fecha_nacimiento)
            : null,
          estado_civil: limpiarTexto(p.estado_civil, 'SOLTERO'),
        },
        create: {
          ci,
          expedido: limpiarTexto(p.expedido, 'LP'),
          nombre: limpiarTexto(p.nombre, 'SIN NOMBRE'),
          apellido_paterno: limpiarTexto(p.apellido_paterno) || null,
          apellido_materno: limpiarTexto(p.apellido_materno) || null,
          apellido_casado: limpiarTexto(p.apellido_casado) || null,
          genero: limpiarTexto(p.genero, 'NO ESPECIFICADO'),
          direccion: limpiarTexto(p.direccion) || null,
          correo_electronico: correo,
          celular: limpiarTexto(p.celular, '00000000'),
          fecha_nacimiento: p.fecha_nacimiento
            ? new Date(p.fecha_nacimiento)
            : null,
          estado_civil: limpiarTexto(p.estado_civil, 'SOLTERO'),
        },
      });

      await prisma.estudiante.upsert({
        where: {
          personaId: persona.ID_persona,
        },
        update: {
          ru: e.ru ? Number(e.ru) : null,
          semestre: Boolean(e.semestre ?? false),
          promedio: Number(e.promedio ?? 0),
          año_ingreso: Number(e.año_ingreso ?? 2023),
          numero_Materias_Reprobadas: Number(
            e.numero_Materias_Reprobadas ?? 0,
          ),
        },
        create: {
          personaId: persona.ID_persona,
          ru: e.ru ? Number(e.ru) : null,
          semestre: Boolean(e.semestre ?? false),
          promedio: Number(e.promedio ?? 0),
          año_ingreso: Number(e.año_ingreso ?? 2023),
          numero_Materias_Reprobadas: Number(
            e.numero_Materias_Reprobadas ?? 0,
          ),
        },
      });

      await prisma.usuario.upsert({
        where: {
          personaId: persona.ID_persona,
        },
        update: {
          username: correo,
          password: hashedPassword,
          activo: true,
        },
        create: {
          username: correo,
          password: hashedPassword,
          activo: true,
          personaId: persona.ID_persona,
        },
      });

      importados++;
      console.log(
        `✅ Importado: ${persona.nombre} | Usuario: ${correo} | Contraseña: ${plainPassword}`,
      );
    } catch (error) {
      console.error(`❌ Error con CI ${ci}:`, error);
    }
  }

  console.log('----------------------------------');
  console.log(`✅ Importados/actualizados: ${importados}`);
  console.log(`⚠️ Saltados sin CI: ${saltados}`);
  console.log('🚀 Importación finalizada');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });