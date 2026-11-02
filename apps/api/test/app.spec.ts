import { afterAll, beforeAll, describe, it } from '@jest/globals';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { type App } from 'supertest/types';

import { AppModule } from '../src/app.module';

// HTTP tests boot the real AppModule and send requests through Nest, as a client would.
describe('the API over HTTP', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers an unknown route with 404', async () => {
    await request(app.getHttpServer()).get('/no-such-route').expect(404);
  });
});
