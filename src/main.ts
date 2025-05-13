import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'body-parser';
import * as express from 'express';
import { AppModule } from './app.module';
import * as http from 'http';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // config max size body
  app.use(json({ limit: '500mb' }));
  app.use(urlencoded({ limit: '500mb', extended: true }));

  app.enableCors();

  // middleware show request, calculate benchmark and time query
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    });
    next();
  });

  app.use('/uploads', express.static('uploads'));

  const server = app.getHttpServer();

  console.log(server instanceof http.Server); // true

  // The timeout value for sockets
  server.setTimeout(2 * 60 * 1000);
  // The number of milliseconds of inactivity a server needs to wait for additional incoming data
  server.keepAliveTimeout = 5000;
  // Limit the amount of time the parser will wait to receive the complete HTTP headers
  server.headersTimeout = 5000;

  await app.listen(3000);
}
bootstrap();
