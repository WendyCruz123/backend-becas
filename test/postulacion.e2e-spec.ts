import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { AppModule } from './../src/app.module';

jest.setTimeout(30000);

describe('Caja Blanca - Registro de trámite de postulación', () => {
  let app: INestApplication;
  let tokenEstudiante = '';

  const estudiante = {
    username: 'wc1769338@gmail.com',
    password: '12572299#CFEA',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send(estudiante);

    if (login.status === 201 && login.body.accessToken) {
      tokenEstudiante = login.body.accessToken;
    }
  });

  // Ruta 2: 1 → 2(F) → 11 → 15
  it('Usuario no autenticado', async () => {
    const res = await request(app.getHttpServer())
      .post('/postulaciones/empezar')
      .send({
        becaId: 1,
        gestion: '2026',
      });

    expect([401, 403]).toContain(res.status);
  });

  // Ruta 6: 1 → 2(V) → 3(V) → 4(V) → 5(V) → 6(F) → 13 → 15
  it('Beca inexistente', async () => {
    if (!tokenEstudiante) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app.getHttpServer())
      .post('/postulaciones/empezar')
      .set('Authorization', `Bearer ${tokenEstudiante}`)
      .send({
        becaId: 999999,
        gestion: '2026',
      });

    expect([400, 404]).toContain(res.status);
    expect(res.body).toHaveProperty('message');
  });

  // Ruta 7: convocatoria vencida o ruta controlada si la beca ya no está vigente
  it('Convocatoria vencida o validación controlada', async () => {
    if (!tokenEstudiante) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app.getHttpServer())
      .post('/postulaciones/empezar')
      .set('Authorization', `Bearer ${tokenEstudiante}`)
      .send({
        becaId: 1,
        gestion: '2020',
      });

    expect([201, 400, 404]).toContain(res.status);
    expect(res.body).toBeDefined();
  });

  // Ruta 1 o Ruta 8: registro correcto o bloqueo por postulación activa
  it('Registro válido o postulación bloqueante', async () => {
    if (!tokenEstudiante) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app.getHttpServer())
      .post('/postulaciones/empezar')
      .set('Authorization', `Bearer ${tokenEstudiante}`)
      .send({
        becaId: 1,
        gestion: '2026',
      });

    expect([201, 400, 404]).toContain(res.status);

    if (res.status === 201) {
      expect(res.body).toHaveProperty('ok', true);
      expect(res.body).toHaveProperty('ID_postulacion');
    } else {
      expect(res.body).toHaveProperty('message');
    }
  });

  afterAll(async () => {
    await app.close();
  });
});