-- CreateTable
CREATE TABLE "persona" (
    "ID_persona" SERIAL NOT NULL,
    "ci" TEXT NOT NULL,
    "expedido" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido_paterno" TEXT NOT NULL,
    "apellido_materno" TEXT NOT NULL,
    "apellido_casado" TEXT,
    "genero" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "correo_electronico" TEXT NOT NULL,
    "celular" TEXT NOT NULL,
    "fecha_nacimiento" TIMESTAMP(3) NOT NULL,
    "estado_civil" TEXT NOT NULL,

    CONSTRAINT "persona_pkey" PRIMARY KEY ("ID_persona")
);

-- CreateTable
CREATE TABLE "usuario" (
    "ID_usuario" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "personaId" INTEGER NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("ID_usuario")
);

-- CreateTable
CREATE TABLE "cargo_administrativo" (
    "ID_cargo" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3) NOT NULL,
    "estado_cargo" BOOLEAN NOT NULL DEFAULT true,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "cargo_administrativo_pkey" PRIMARY KEY ("ID_cargo")
);

-- CreateTable
CREATE TABLE "grupo_usuario" (
    "ID_grupo_usuario" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "grupoRolId" INTEGER NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grupo_usuario_pkey" PRIMARY KEY ("ID_grupo_usuario")
);

-- CreateTable
CREATE TABLE "grupo_rol" (
    "ID_grupo_rol" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "grupo_rol_pkey" PRIMARY KEY ("ID_grupo_rol")
);

-- CreateTable
CREATE TABLE "estudiante" (
    "ID_estudiante" SERIAL NOT NULL,
    "personaId" INTEGER NOT NULL,
    "semestre_actual" TEXT NOT NULL,
    "estado_academico" BOOLEAN NOT NULL DEFAULT true,
    "promedio" INTEGER NOT NULL,
    "fecha_ingreso" TIMESTAMP(3) NOT NULL,
    "numero_Materias_Reprobadas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "estudiante_pkey" PRIMARY KEY ("ID_estudiante")
);

-- CreateTable
CREATE TABLE "oficina" (
    "ID_oficina" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "horario_atencion" TEXT NOT NULL,
    "estado_oficina" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "oficina_pkey" PRIMARY KEY ("ID_oficina")
);

-- CreateTable
CREATE TABLE "encargado_oficina" (
    "ID_encargado" SERIAL NOT NULL,
    "personaId" INTEGER NOT NULL,
    "oficinaId" INTEGER NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "turno_atencion" TEXT NOT NULL,

    CONSTRAINT "encargado_oficina_pkey" PRIMARY KEY ("ID_encargado")
);

-- CreateIndex
CREATE UNIQUE INDEX "persona_ci_key" ON "persona"("ci");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_username_key" ON "usuario"("username");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_personaId_key" ON "usuario"("personaId");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "persona"("ID_persona") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_administrativo" ADD CONSTRAINT "cargo_administrativo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("ID_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_usuario" ADD CONSTRAINT "grupo_usuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("ID_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_usuario" ADD CONSTRAINT "grupo_usuario_grupoRolId_fkey" FOREIGN KEY ("grupoRolId") REFERENCES "grupo_rol"("ID_grupo_rol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudiante" ADD CONSTRAINT "estudiante_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "persona"("ID_persona") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encargado_oficina" ADD CONSTRAINT "encargado_oficina_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "persona"("ID_persona") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encargado_oficina" ADD CONSTRAINT "encargado_oficina_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "oficina"("ID_oficina") ON DELETE RESTRICT ON UPDATE CASCADE;
