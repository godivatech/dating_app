import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global API prefix — all routes will be prefixed with /api/v1
  // Example: GET /api/v1/health
  app.setGlobalPrefix('api/v1');

  // Global validation pipe
  // Enforces class-validator decorators on all incoming DTOs.
  // whitelist: true — strips unknown properties (never trust client-supplied extra fields)
  // forbidNonWhitelisted: true — throws an error if unknown properties are sent
  // transform: true — auto-transforms plain objects to typed class instances
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable CORS for mobile devices and web clients
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Enable graceful shutdown hooks for proper cleanup
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`Backend running on http://0.0.0.0:${port}/api/v1 (accessible at http://10.99.28.115:${port}/api/v1)`);
}

void bootstrap();

