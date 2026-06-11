import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

function validateSecrets() {
  const insecureDefaults: Record<string, string> = {
    JWT_ACCESS_SECRET: 'change_me',
    JWT_REFRESH_SECRET: 'change_me_too',
    GOOGLE_OAUTH_STATE_SECRET: 'change_me_state',
  };
  if (process.env.NODE_ENV !== 'production') return;
  for (const [key, insecure] of Object.entries(insecureDefaults)) {
    const value = process.env[key];
    if (!value || value === insecure) {
      throw new Error(
        `[startup] ${key} must be set to a secure value in production.`,
      );
    }
  }
}

async function bootstrap() {
  validateSecrets();
  const app = await NestFactory.create(AppModule);
  const corsOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (corsOrigins.length === 0 && process.env.NODE_ENV === 'production') {
    throw new Error('[startup] CORS_ORIGIN must be set in production.');
  }
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 5050);
}
void bootstrap();
