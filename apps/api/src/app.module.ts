import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';

import { databaseConfig } from './database/database.config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { httpConfig } from './http/http.config';
import { ProblemDetailsFilter } from './http/problem-details.filter';
import { SchemaValidationPipe } from './http/schema-validation.pipe';

@Module({
  imports: [
    // Builds every configuration namespace at startup; an invalid variable stops the start.
    // Global, so any module can inject a namespace without importing ConfigModule again.
    ConfigModule.forRoot({ isGlobal: true, load: [httpConfig, databaseConfig] }),
    DatabaseModule,
    HealthModule,
  ],
  // Registered as providers, not with useGlobalFilters() or useGlobalPipes(), so they also apply
  // in tests and can inject dependencies.
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_PIPE, useValue: new SchemaValidationPipe() },
  ],
})
export class AppModule {}
