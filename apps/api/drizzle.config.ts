import { defineConfig } from 'drizzle-kit';

// Read by `npm run db:generate`, which writes a new SQL migration for every change to the tables
// declared in the modules' entity files. Generating needs no database: drizzle-kit compares the
// entities with the snapshot it saved next to the last migration.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/modules/*/entities/*.entity.ts',
  out: './migrations',
});
