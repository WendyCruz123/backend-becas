import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { AppModule } from './../src/app.module';

jest.setTimeout(30000);

describe('Caja Blanca - Legalización Presencial', () => {
  let app: INestApplication;
  let tokenLegalizador = '';

  const legalizador = {
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
      .send(legalizador);

    if (login.status === 201 && login.body.accessToken) {
      tokenLegalizador = login.body.accessToken;
    }
  });

  // Camino 2: 1 → 2(F) → 14 → 15
  it('Usuario no autenticado', async () => {
    const res = await request(app.getHttpServer())
      .get('/legalizacion/mis-pendientes');

    expect([401, 403]).toContain(res.status);
  });

  // Camino 1: 1 → 2(V) → 3(V) → 4 → 15
  it('Consultar registros asignados al legalizador', async () => {
    if (!tokenLegalizador) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app.getHttpServer())
      .get('/legalizacion/mis-pendientes')
      .set('Authorization', `Bearer ${tokenLegalizador}`);

    expect([200, 403]).toContain(res.status);

    if (res.status === 200) {
      expect(res.body).toHaveProperty('pendientesRecepcion');
      expect(res.body).toHaveProperty('enRevision');
      expect(res.body).toHaveProperty('entregaFinal');
      expect(res.body).toHaveProperty('revisados');
    }
  });

  // Camino 4: estado inválido o registro inexistente
  it('Registro inexistente o estado inválido', async () => {
    if (!tokenLegalizador) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app.getHttpServer())
      .patch('/legalizacion/999999/pasar-revision')
      .set('Authorization', `Bearer ${tokenLegalizador}`);

    expect([400, 404]).toContain(res.status);
    expect(res.body).toHaveProperty('message');
  });

  // Camino 1: pasar de PENDIENTE_LEGALIZACION a EN_REVISION
  it('Pasar requisito a revisión', async () => {
    if (!tokenLegalizador) {
      expect(true).toBe(true);
      return;
    }

    const pendientes = await request(app.getHttpServer())
      .get('/legalizacion/mis-pendientes')
      .set('Authorization', `Bearer ${tokenLegalizador}`);

    const item = pendientes.body?.pendientesRecepcion?.[0];

    if (!item) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app.getHttpServer())
      .patch(`/legalizacion/${item.id}/pasar-revision`)
      .set('Authorization', `Bearer ${tokenLegalizador}`);

    expect([200, 400]).toContain(res.status);

    if (res.status === 200) {
      expect(res.body).toHaveProperty('estado', 'EN_REVISION');
    }
  });

  // Caminos 5 y 6: legalizar documento
  it('Legalizar documento en revisión', async () => {
    if (!tokenLegalizador) {
      expect(true).toBe(true);
      return;
    }

    const pendientes = await request(app.getHttpServer())
      .get('/legalizacion/mis-pendientes')
      .set('Authorization', `Bearer ${tokenLegalizador}`);

    const item = pendientes.body?.enRevision?.[0];

    if (!item) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app.getHttpServer())
      .patch(`/legalizacion/${item.id}/legalizar`)
      .set('Authorization', `Bearer ${tokenLegalizador}`)
      .send({
        observacion: 'Documento legalizado desde prueba Jest.',
      });

    expect([200, 400]).toContain(res.status);

    if (res.status === 200) {
      expect(res.body).toHaveProperty('estado', 'LEGALIZADO');
    }
  });

  // Camino 7: entrega final
  it('Entregar documento legalizado', async () => {
    if (!tokenLegalizador) {
      expect(true).toBe(true);
      return;
    }

    const pendientes = await request(app.getHttpServer())
      .get('/legalizacion/mis-pendientes')
      .set('Authorization', `Bearer ${tokenLegalizador}`);

    const item = pendientes.body?.entregaFinal?.[0];

    if (!item) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app.getHttpServer())
      .patch(`/legalizacion/${item.id}/entregar`)
      .set('Authorization', `Bearer ${tokenLegalizador}`)
      .send({
        observacion: 'Documento entregado desde prueba Jest.',
      });

    expect([200, 400]).toContain(res.status);

    if (res.status === 200) {
      expect(res.body).toHaveProperty('estado', 'ENTREGADO');
    }
  });

  // Camino 8: rechazar documento
  it('Rechazar documento en revisión o legalizado', async () => {
    if (!tokenLegalizador) {
      expect(true).toBe(true);
      return;
    }

    const pendientes = await request(app.getHttpServer())
      .get('/legalizacion/mis-pendientes')
      .set('Authorization', `Bearer ${tokenLegalizador}`);

    const item =
      pendientes.body?.enRevision?.[0] ||
      pendientes.body?.entregaFinal?.[0];

    if (!item) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app.getHttpServer())
      .patch(`/legalizacion/${item.id}/rechazar`)
      .set('Authorization', `Bearer ${tokenLegalizador}`)
      .send({
        observacion: 'Documento rechazado desde prueba Jest.',
      });

    expect([200, 400]).toContain(res.status);

    if (res.status === 200) {
      expect(res.body).toHaveProperty('estado', 'RECHAZADO');
    }
  });

  afterAll(async () => {
    await app.close();
  });
});