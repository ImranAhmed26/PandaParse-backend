import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // ✅ CORS CONFIGURATION
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const frontendUrl = configService.get<string>('FRONTEND_URL');

  if (isProduction && !frontendUrl) {
    console.error('CORS ERROR: ❌ FRONTEND_URL is not set in production!');
    process.exit(1);
  }

  const allowedOrigins: string[] = frontendUrl
    ? frontendUrl.split(',').map(o => o.trim())
    : [];

  if (!isProduction) {
    allowedOrigins.push('http://localhost:3210');
  }

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  });

  // ✅ Global API prefix
  const apiPrefix = configService.get<string>('API_PREFIX') || 'api';

  if (apiPrefix.startsWith('/') || apiPrefix.endsWith('/')) {
    console.warn('⚠️ API_PREFIX should not contain leading or trailing slashes. Trimming...');
    const trimmedPrefix = apiPrefix.replace(/^\/+|\/+$/g, '');
    console.log(`📝 Using API prefix: '${trimmedPrefix}' (was: '${apiPrefix}')`);
    app.setGlobalPrefix(trimmedPrefix);
  } else {
    console.log(`📝 Using API prefix: '${apiPrefix}'`);
    app.setGlobalPrefix(apiPrefix);
  }

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
