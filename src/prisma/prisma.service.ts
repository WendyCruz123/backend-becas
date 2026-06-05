import { Injectable, OnModuleInit, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super(); // Puedes pasar { log: ['query', 'error', 'warn'] } si quieres debug
  }

  async onModuleInit() {
    // Conecta explícitamente al levantar el módulo
    await this.$connect();
  }

  // Llamas a esto (opcional) en main.ts para cerrar la app cuando Prisma termine
  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }
}
