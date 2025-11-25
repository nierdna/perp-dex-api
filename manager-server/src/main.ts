import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from '@/api/filters/GlobalExceptionFilter';
import { Logger as PinoLogger } from 'nestjs-pino';
import session from 'express-session';
import passport from 'passport';

const isApi = Boolean(Number(process.env.IS_API || 0));

const PORT = process.env.PORT || '3000';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // logger: false,
    // bufferLogs: true,
  });

  if (isApi) {
    // const corsOrigin = process.env.CORS_ORIGIN.split(',') || [
    //   'http://localhost:3000',
    // ];

    app.enableCors({
      // allowedHeaders: ['content-type'],
      origin: '*',
      credentials: true, // Required for session cookies
    });

    // Session middleware (required for OAuth)
    app.use(
      session({
        secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
        resave: false,
        saveUninitialized: false,
        cookie: {
          maxAge: 3600000, // 1 hour
        },
      }),
    );

    // Initialize Passport
    app.use(passport.initialize());
    app.use(passport.session());

    app.useLogger(app.get(PinoLogger));
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter(true, true));

    if (process.env.APP_ENV !== 'production') {
      const options = new DocumentBuilder()
        .setTitle('API docs')
        // .setVersion(DEFAULT_API_VERSION)
        .addBearerAuth()
        .build();
      const document = SwaggerModule.createDocument(app, options);
      SwaggerModule.setup('docs', app, document);
    }
    await app.listen(PORT);
    Logger.log(`🚀 Application is running in port http://localhost:${PORT}`);
  } else {
    await app.init();
  }
}
bootstrap();
