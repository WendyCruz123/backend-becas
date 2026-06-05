import { Test, TestingModule } from '@nestjs/testing';
import { Rutas360Controller } from './rutas360.controller';

describe('Rutas360Controller', () => {
  let controller: Rutas360Controller;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [Rutas360Controller],
    }).compile();

    controller = module.get<Rutas360Controller>(Rutas360Controller);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
