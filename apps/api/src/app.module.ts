import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';

import { envSchema } from './config/env';
import { ProblemDetailsFilter } from './http/problem-details.filter';
import { SchemaValidationPipe } from './http/schema-validation.pipe';

@Module({
  imports: [
    // Global, so feature modules inject ConfigService without importing ConfigModule again.
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
  ],
  // Registered as providers, not with useGlobalFilters() or useGlobalPipes(), so they also apply
  // in tests and can inject dependencies.
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_PIPE, useValue: new SchemaValidationPipe() },
  ],
})
export class AppModule {}
