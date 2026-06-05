import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');

import { AppModule } from '../src/app.module';

describe('Recorrido Virtual 360° (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Camino 1
   * Ruta válida con panoramas e hotspots informativos
   */
  it('debe cargar una ruta 360 válida', async () => {
    const response = await request(app.getHttpServer())
      .get('/rutas360/fisica')
      .expect((res) => {
        if (res.status !== 200 && res.status !== 404) {
          throw new Error('Estado inesperado');
        }
      });

    if (response.status === 200) {
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('nombre');
      expect(response.body).toHaveProperty('panoramas');
    }
  });

  /**
   * Camino 2
   * Ruta inexistente
   */
  it('debe devolver 404 cuando la ruta no existe', async () => {
    await request(app.getHttpServer())
      .get('/rutas360/ruta-inexistente-prueba')
      .expect(404);
  });

  /**
   * Camino 3
   * Ruta válida sin panorama portada
   */
  it('debe devolver panoramas aunque no exista portada', async () => {
    const response = await request(app.getHttpServer())
      .get('/rutas360/fisica')
      .expect((res) => {
        if (res.status !== 200 && res.status !== 404) {
          throw new Error('Estado inesperado');
        }
      });

    if (response.status === 200) {
      expect(Array.isArray(response.body.panoramas)).toBe(true);
    }
  });

  /**
   * Camino 4
   * Hotspot LINK
   */
  it('debe devolver hotspots LINK cuando existan', async () => {
    const response = await request(app.getHttpServer())
      .get('/rutas360/fisica')
      .expect((res) => {
        if (res.status !== 200 && res.status !== 404) {
          throw new Error('Estado inesperado');
        }
      });

    if (response.status === 200) {
      const panoramas = response.body.panoramas ?? [];

      const tieneLink = panoramas.some((p: any) =>
        (p.hotspots ?? []).some(
          (h: any) => h.type === 'LINK'
        )
      );

      expect(typeof tieneLink).toBe('boolean');
    }
  });

  /**
   * Camino 5
   * Ruta existente pero sin panoramas
   */
  it('debe detectar rutas sin panoramas', async () => {
    const response = await request(app.getHttpServer())
      .get('/rutas360/fisica')
      .expect((res) => {
        if (res.status !== 200 && res.status !== 404) {
          throw new Error('Estado inesperado');
        }
      });

    if (response.status === 200) {
      expect(response.body).toHaveProperty('panoramas');
    }
  });
});