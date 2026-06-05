import { NotFoundException } from '@nestjs/common';
import { Rutas360Service } from './rutas360.service';

describe('Rutas360Service', () => {
  let service: Rutas360Service;

  const prismaMock = {
    ruta_360: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new Rutas360Service(prismaMock as any);
  });

  describe('findBySlug', () => {
    it('debe retornar una ruta válida con panoramas', async () => {
      prismaMock.ruta_360.findUnique.mockResolvedValue({
        id: 'ruta1',
        nombre: 'Bloque A',
        slug: 'bloque_a',
        panoramas: [
          {
            id: 'p1',
            name: 'Entrada',
            es_portada: true,
            hotspots: [],
          },
        ],
      });

      const result = await service.findBySlug('bloque_a');

      expect(result).toBeDefined();
      expect(result.slug).toBe('bloque_a');
      expect(result.panoramas.length).toBeGreaterThan(0);
    });

    it('debe lanzar excepción cuando la ruta no existe', async () => {
      prismaMock.ruta_360.findUnique.mockResolvedValue(null);

      await expect(
        service.findBySlug('ruta_inexistente'),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe retornar una ruta sin panoramas', async () => {
      prismaMock.ruta_360.findUnique.mockResolvedValue({
        id: 'ruta2',
        nombre: 'Ruta Vacía',
        slug: 'ruta_vacia',
        panoramas: [],
      });

      const result = await service.findBySlug('ruta_vacia');

      expect(result.panoramas).toEqual([]);
    });

    it('debe identificar panorama portada', async () => {
      prismaMock.ruta_360.findUnique.mockResolvedValue({
        id: 'ruta3',
        slug: 'fisica',
        panoramas: [
          {
            id: 'p1',
            es_portada: true,
            hotspots: [],
          },
          {
            id: 'p2',
            es_portada: false,
            hotspots: [],
          },
        ],
      });

      const result = await service.findBySlug('fisica');

      const portada = result.panoramas.find(
        (p: any) => p.es_portada,
      );

      expect(portada).toBeDefined();
    });

    it('debe cargar hotspots asociados al panorama', async () => {
      prismaMock.ruta_360.findUnique.mockResolvedValue({
        id: 'ruta4',
        slug: 'laboratorio',
        panoramas: [
          {
            id: 'p1',
            es_portada: true,
            hotspots: [
              {
                id: 'h1',
                type: 'INFORMACION',
              },
              {
                id: 'h2',
                type: 'LINK',
              },
            ],
          },
        ],
      });

      const result = await service.findBySlug('laboratorio');

      expect(
        result.panoramas[0].hotspots.length,
      ).toBe(2);
    });
  });
});