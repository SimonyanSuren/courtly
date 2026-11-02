/** Stops the PostgreSQL container that global-setup.ts started. */
export default async function globalTeardown(): Promise<void> {
  await globalThis.postgresContainer?.stop();
}
