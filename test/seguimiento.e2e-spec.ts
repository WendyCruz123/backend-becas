import { NotFoundException } from '@nestjs/common';
import { PostulacionesService } from '../src/postulaciones/postulaciones.service';

describe('Prueba de Caja Blanca - Consulta de Seguimiento por Código', () => {
  let service: PostulacionesService;

  const prismaMock: any = {
    postulacion: {
      findUnique: jest.fn(),
    },
    audit_log: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    service = new PostulacionesService(
      prismaMock,
      {} as any,
      {} as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Ruta 1
   * Código válido con observación administrativa
   */
  it('debe mostrar seguimiento completo con observación', async () => {
    prismaMock.postulacion.findUnique.mockResolvedValue({
      ID_postulacion: '1',
      codigo_seguimiento: 'BEC-2026-AAAAA',
      estado: 'PENDIENTE',
      gestion: '2026',
      fecha: new Date(),
      observacion: 'Falta presentar documento.',
      estado_observacion: 'OBSERVADO',
      abandono_recuperable: false,
      motivo_abandono: null,

      beca_historial_capturado: true,
      beca_nombre_historico: 'Beca Excelencia',
      beca_tipo_historico: 'Académica',

      beca: {
        nombre: 'Beca Excelencia',
        tipo: 'Académica',
      },

      paso_estudiante: [],
    });

    prismaMock.audit_log.findMany.mockResolvedValue([
      {
        accion: 'OBSERVAR',
        detalle: 'Documentación observada',
        createdAt: new Date(),
        despues: {
          estado_observacion: 'OBSERVADO',
        },
        usuario: {
          persona: {
            nombre: 'Administrador',
            apellido_paterno: 'Sistema',
          },
        },
      },
    ]);

    const result =
      await service.consultarSeguimientoPorCodigo(
        'BEC-2026-AAAAA',
      );

    expect(result.codigo_seguimiento)
      .toBe('BEC-2026-AAAAA');

    expect(result.observacion_detalle.tipo)
      .toBe('OBSERVADO');
  });

  /**
   * Ruta 2
   * Código inexistente
   */
  it('debe lanzar NotFoundException cuando el código no existe', async () => {
    prismaMock.postulacion.findUnique.mockResolvedValue(null);

    await expect(
      service.consultarSeguimientoPorCodigo(
        'CODIGO-INEXISTENTE',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  /**
   * Ruta 3
   * Código válido sin etapas
   */
  it('debe devolver seguimiento válido sin etapas', async () => {
    prismaMock.postulacion.findUnique.mockResolvedValue({
      ID_postulacion: '2',
      codigo_seguimiento: 'BEC-2026-BBBBB',
      estado: 'PENDIENTE',
      gestion: '2026',
      fecha: new Date(),
      observacion: null,
      estado_observacion: 'NO OBSERVADO',

      abandono_recuperable: false,
      motivo_abandono: null,

      beca_historial_capturado: true,
      beca_nombre_historico: 'Beca Comedor',
      beca_tipo_historico: 'Social',

      beca: {
        nombre: 'Beca Comedor',
        tipo: 'Social',
      },

      paso_estudiante: [],
    });

    prismaMock.audit_log.findMany.mockResolvedValue([]);

    const result =
      await service.consultarSeguimientoPorCodigo(
        'BEC-2026-BBBBB',
      );

    expect(result.etapas.length)
      .toBe(0);

    expect(result.estado_general)
      .toBe('PENDIENTE');
  });

  /**
   * Ruta 4
   * Código válido con etapas
   */
  it('debe devolver etapas registradas', async () => {
    prismaMock.postulacion.findUnique.mockResolvedValue({
      ID_postulacion: '3',
      codigo_seguimiento: 'BEC-2026-CCCCC',
      estado: 'HABILITADO',
      gestion: '2026',
      fecha: new Date(),

      observacion: null,
      estado_observacion: 'NO OBSERVADO',

      abandono_recuperable: false,
      motivo_abandono: null,

      beca_historial_capturado: true,
      beca_nombre_historico: 'Beca Investigación',
      beca_tipo_historico: 'Científica',

      beca: {
        nombre: 'Beca Investigación',
        tipo: 'Científica',
      },

      paso_estudiante: [
        {
          estado_etapa: 'EN_REVISION',
          completado: false,
          nota_etapa: null,
          fecha_etapa: null,
          descripcion_etapa: null,
          texto_extra_etapa: null,

          oficinaRuta: null,

          pasoBeca: {
            requisito: {
              tipo_requisito: 'ETAPA',
              nombre: 'Entrevista',
              descripcion: 'Evaluación oral',
            },
          },
        },
      ],
    });

    prismaMock.audit_log.findMany.mockResolvedValue([]);

    const result =
      await service.consultarSeguimientoPorCodigo(
        'BEC-2026-CCCCC',
      );

    expect(result.etapas.length)
      .toBe(1);

    expect(result.etapas[0].nombre)
      .toBe('Entrevista');
  });

  /**
   * Ruta 5
   * Código válido con ruta 360°
   */
  it('debe devolver información de ruta 360 asociada a una etapa', async () => {
    prismaMock.postulacion.findUnique.mockResolvedValue({
      ID_postulacion: '4',
      codigo_seguimiento: 'BEC-2026-DDDDD',
      estado: 'HABILITADO',
      gestion: '2026',
      fecha: new Date(),

      observacion: null,
      estado_observacion: 'NO OBSERVADO',

      abandono_recuperable: false,
      motivo_abandono: null,

      beca_historial_capturado: true,
      beca_nombre_historico: 'Beca Docencia',
      beca_tipo_historico: 'Académica',

      beca: {
        nombre: 'Beca Docencia',
        tipo: 'Académica',
      },

      paso_estudiante: [
        {
          estado_etapa: 'EN_REVISION',
          completado: false,

          nota_etapa: null,
          fecha_etapa: null,
          descripcion_etapa: null,
          texto_extra_etapa: null,

          oficinaRuta: {
            ID_oficina: 1,
            nombre: 'Laboratorio Física',
            panorama_route_slug:
              'laboratorio-fisica',
            horario_atencion: '08:00 - 16:00',
          },

          pasoBeca: {
            requisito: {
              tipo_requisito: 'ETAPA',
              nombre: 'Práctica',
              descripcion: 'Evaluación práctica',
            },
          },
        },
      ],
    });

    prismaMock.audit_log.findMany.mockResolvedValue([]);

    const result =
      await service.consultarSeguimientoPorCodigo(
        'BEC-2026-DDDDD',
      );

    expect(
      result.etapas[0].ruta360?.slug,
    ).toBe('laboratorio-fisica');
  });
});