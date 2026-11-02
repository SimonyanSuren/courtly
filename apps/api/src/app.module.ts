import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { envSchema } from './config/env';

@Module({
  imports: [
    // Global, so feature modules inject ConfigService without importing ConfigModule again.
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
  ],
})
export class AppModule {}
