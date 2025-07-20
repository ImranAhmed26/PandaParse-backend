import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // ✅ CORS CONFIGURATION
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const allowedOrigin = isProduction
    ? configService.get<string>('FRONTEND_URL')!
    : 'http://localhost:3000';

  if (isProduction && !allowedOrigin) {
    console.error('CORS ERROR: ❌ FRONTEND_URL is not set in production!');
    process.exit(1);
  }

  app.enableCors({
    origin: allowedOrigin,
    credentials: true,
  });

  // ✅ Global API prefix
  const apiPrefix = configService.get<string>('API_PREFIX') || 'api';
  app.setGlobalPrefix(apiPrefix);

  // ✅ Swagger (only in non-production)
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('TextStack API')
      .setDescription('API for managing documents')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

    console.log(
      `📚 Swagger: http://localhost:${configService.get<number>('PORT') ?? 8000}/${apiPrefix}/docs`,
    );
  }

  const port = configService.get<number>('PORT') ?? 8000;
  await app.listen(port);

  console.log(`🚀 Server running at http://localhost:${port}`);
}

bootstrap().catch(error => {
  console.error('❌ Failed to bootstrap the application:', error);
  process.exit(1);
});
