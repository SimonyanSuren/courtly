import { defineConfig } from 'drizzle-kit';

// Read by `npm run db:generate`, which writes a new SQL migration for every change to the tables
// declared in the modules' `*.schema.ts` files. Generating needs no database: drizzle-kit compares
// the tables with the snapshot it saved next to the last migration.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/modules/**/*.schema.ts',
  out: './migrations',
});
