import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';

import { authConfig } from './modules/auth/auth.config';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { CourtsModule } from './modules/courts/courts.module';
import { databaseConfig } from './platform/database/database.config';
import { DatabaseModule } from './platform/database/database.module';
import { HealthModule } from './platform/health/health.module';
import { httpConfig } from './platform/http/http.config';
import { ProblemDetailsFilter } from './platform/http/problem-details.filter';
import { SchemaValidationPipe } from './platform/http/schema-validation.pipe';

@Module({
  imports: [
    // Builds every configuration namespace at startup; an invalid variable stops the start.
    // Global, so any module can inject a namespace without importing ConfigModule again. Only
    // real environment variables count: the local scripts load apps/api/.env themselves, so a
    // developer's settings never reach the tests.
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      load: [httpConfig, databaseConfig, authConfig],
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    CourtsModule,
    BookingsModule,
  ],
  // Registered as providers, not with useGlobalFilters() or useGlobalPipes(), so they also apply
  // in tests and can inject dependencies.
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_PIPE, useValue: new SchemaValidationPipe() },
  ],
})
export class AppModule {}
