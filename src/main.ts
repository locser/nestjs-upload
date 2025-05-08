import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'body-parser';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // config max size body
  app.use(json({ limit: '500mb' }));
  app.use(urlencoded({ limit: '500mb', extended: true }));

  app.enableCors();

  // middleware show request
  app.use((req, res, next) => {
    console.log('Request...' + req.url);
    console.log(req.body);
    console.log(req.file);
    next();
  });

  app.use('/uploads', express.static('uploads'));

  await app.listen(3000);
}
bootstrap();
