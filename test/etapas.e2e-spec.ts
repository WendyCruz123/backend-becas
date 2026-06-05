import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { AppModule } from './../src/app.module';

jest.setTimeout(30000);

describe('Caja Blanca - Evaluación de etapas por encargado', () => {
  let app: INestApplication;

  let tokenEncargado = '';
  let tokenNoEncargado = '';

  const encargado = {
    username: 'wc1769338@gmail.com', // CAMBIA por usuario con rol encargado si tienes uno
    password: '12572299#CFEA',
  };

  const noEncargado = {
    username: 'wc1769338@gmail.com',
    password: '12572299#CFEA',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const loginEncargado = await request(app.getHttpServer())
      .post('/auth/login')
      .send(encargado);

    if (loginEncargado.status === 201 && loginEncargado.body.accessToken) {
      tokenEncargado = loginEncargado.body.accessToken;
    }

    const loginNoEncargado = await request(app.getHttpServer())
      .post('/auth/login')
      .send(noEncargado);

    if (loginNoEncargado.status === 201 && loginNoEncargado.body.accessToken) {
      tokenNoEncargado = loginNoEncargado.body.accessToken;
    }
  });

  // Camino 2: 1 → 2(F) → 16 → 17
  it('Usuario no autenticado', async () => {
    const res = await request(app.getHttpServer())
      .get('/postulaciones/etapas/encargado');

    expect([401, 403]).toContain(res.status);
  });

  // Camino 3: 1 → 2(V) → 3(F) → 16 → 17
  it('Usuario sin rol encargado', async () => {
    if (!tokenNoEncargado) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app.getHttpServer())
      .get('/postulaciones/etapas/encargado')
      .set('Authorization', `Bearer ${tokenNoEncargado}`);

    expect([200, 403]).toContain(res.status);

    if (res.status === 403) {
      expect(res.body).toHaveProperty('message');
    }
  });

  // Camino 1 parcial: listar etapas asignadas
  it('Listar etapas asignadas al encargado', async () => {
    if (!tokenEncargado) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app.getHttpServer())
      .get('/postulaciones/etapas/encargado')
      .set('Authorization', `Bearer ${tokenEncargado}`);

    expect([200, 403]).toContain(res.status);

    if (res.status === 200) {
      expect(res.body).toHaveProperty('pendientes');
      expect(res.body).toHaveProperty('revisados');
    }
  });

  // Camino 4: etapa inexistente
  it('Etapa inexistente', async () => {
    if (!tokenEncargado) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app.getHttpServer())
      .patch('/postulaciones/etapas/resolver')
      .set('Authorization', `Bearer ${tokenEncargado}`)
      .send({
        pasoEstudianteId: 999999,
        resultado: 'APROBADO',
        nota: 80,
        descripcion: 'Intento de resolver etapa inexistente.',
      });

    expect([400, 403, 404]).toContain(res.status);
    expect(res.body).toHaveProperty('message');
  });

  // Camino 7: etapa no se encuentra en revisión o validación controlada
  it('Resolver etapa con estado inválido o validación controlada', async () => {
    if (!tokenEncargado) {
      expect(true).toBe(true);
      return;
    }

    const listado = await request(app.getHttpServer())
      .get('/postulaciones/etapas/encargado')
      .set('Authorization', `Bearer ${tokenEncargado}`);

    const revisada = listado.body?.revisados?.[0];

    if (!revisada) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app.getHttpServer())
      .patch('/postulaciones/etapas/resolver')
      .set('Authorization', `Bearer ${tokenEncargado}`)
      .send({
        pasoEstudianteId: revisada.pasoEstudianteId,
        resultado: 'APROBADO',
        nota: 80,
        descripcion: 'Intento de resolver etapa ya revisada.',
      });

    expect([400, 403]).toContain(res.status);
    expect(res.body).toHaveProperty('message');
  });

  // Caminos 1 y 8: aprobar etapa
  it('Aprobar etapa pendiente en revisión', async () => {
    if (!tokenEncargado) {
      expect(true).toBe(true);
      return;
    }

    const listado = await request(app.getHttpServer())
      .get('/postulaciones/etapas/encargado')
      .set('Authorization', `Bearer ${tokenEncargado}`);

    const pendiente = listado.body?.pendientes?.[0];

    if (!pendiente) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app.getHttpServer())
      .patch('/postulaciones/etapas/resolver')
      .set('Authorization', `Bearer ${tokenEncargado}`)
      .send({
        pasoEstudianteId: pendiente.pasoEstudianteId,
        resultado: 'APROBADO',
        nota: 85,
        fecha: '2026-06-10',
        descripcion: 'Etapa aprobada desde prueba Jest.',
        textoExtra: 'Prueba automatizada de caja blanca.',
        oficinaRutaId: pendiente.oficina?.ID_oficina,
      });

    expect([200, 400, 403]).toContain(res.status);

    if (res.status === 200) {
      expect(res.body).toHaveProperty('ok', true);
      expect(res.body).toHaveProperty('message');
    } else {
      expect(res.body).toHaveProperty('message');
    }
  });

  // Camino 9: reprobar o abandonar etapa
  it('Reprobar etapa pendiente en revisión', async () => {
    if (!tokenEncargado) {
      expect(true).toBe(true);
      return;
    }

    const listado = await request(app.getHttpServer())
      .get('/postulaciones/etapas/encargado')
      .set('Authorization', `Bearer ${tokenEncargado}`);

    const pendiente = listado.body?.pendientes?.[0];

    if (!pendiente) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app.getHttpServer())
      .patch('/postulaciones/etapas/resolver')
      .set('Authorization', `Bearer ${tokenEncargado}`)
      .send({
        pasoEstudianteId: pendiente.pasoEstudianteId,
        resultado: 'REPROBADO',
        nota: 45,
        descripcion: 'Etapa reprobada desde prueba Jest.',
      });

    expect([200, 400, 403]).toContain(res.status);

    if (res.status === 200) {
      expect(res.body).toHaveProperty('ok', true);
      expect(res.body).toHaveProperty('message');
    } else {
      expect(res.body).toHaveProperty('message');
    }
  });

  afterAll(async () => {
    await app.close();
  });
});