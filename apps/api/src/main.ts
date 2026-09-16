import { ValidationPipe, Logger, ValidationError, BadRequestException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  app.setGlobalPrefix('api');
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: (errors: ValidationError[]) => {
      const messages = errors.map(error => {
        const constraints = error.constraints;
        const field = error.property;
        const errorMessages = Object.values(constraints || {}).join(', ');
        return `${field}: ${errorMessages}`;
      });
      return new BadRequestException(`Validation failed: ${messages.join('; ')}`);
    },
  }));
  
  app.useGlobalFilters(new HttpExceptionFilter());

  // Log all incoming requests
  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
  });

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}

await bootstrap();