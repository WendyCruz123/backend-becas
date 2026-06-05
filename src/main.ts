import * as cookieParser from 'cookie-parser'
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { join } from 'path';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());//habilitar el parser de cookies
app.enableCors({
  origin: true,
  credentials: true,
  methods: 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'x-reset-token',
  ],
});

  app.use(
  '/uploads',
  express.static(join(process.cwd(), 'uploads'), {
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  }),
);
  
  app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  errorHttpStatusCode: 400,
  transformOptions: {
    enableImplicitConversion: true,
  },
  exceptionFactory: (errors) => {
    const messages = errors.map(
      err => ({
        property: err.property,
        constraints: err.constraints
      })
    );
    return new BadRequestException(messages);
  }
}));
 const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app); // opcional, pero recomendado
  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();
