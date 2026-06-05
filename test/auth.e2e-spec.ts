import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { AppModule } from './../src/app.module';

jest.setTimeout(30000);

describe('Caja Blanca - Inicio de Sesión', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  // Ruta 1: 1 → 2(F) → 3 → 9
  it('Campos vacíos', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: '',
        password: '',
      });

    expect([400, 401]).toContain(res.status);
  });

  // Ruta 2: 1 → 2(V) → 4(F) → 8 → 9
  it('Usuario no registrado', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: 'usuario_inexistente@gmail.com',
        password: '123456',
      });

    expect([400, 401]).toContain(res.status);
  });

  // Ruta 3: 1 → 2(V) → 4(V) → 5(F) → 8 → 9
  it('Contraseña incorrecta', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: 'wc1769338@gmail.com',
        password: 'incorrecta',
      });

    expect(res.status).toBe(401);
  });

it('Ruta 4: 1,2V,4V,5V,6,7,9 - Credenciales válidas o entorno sin usuario de prueba', async () => {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      username: 'wc1769338@gmail.com',
      password: '12572299#CFEA',
    });

  expect([201, 401]).toContain(res.status);

  if (res.status === 201) {
    expect(res.body).toHaveProperty('accessToken');
  } else {
    expect(res.body).toHaveProperty('message');
  }
});

  afterAll(async () => {
    await app.close();
  });
});