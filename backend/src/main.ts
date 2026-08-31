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

  // Enable graceful shutdown hooks for proper cleanup
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`Backend running on http://localhost:${port}/api/v1`);
}

void bootstrap();
