import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    // The app calls the API under /api on its own origin, so the browser needs no CORS and the
    // session cookie stays first-party. The object form keeps the browser's Host header (the
    // string shorthand rewrites it): when Sec-Fetch-Site is missing, the API's cross-origin check
    // compares Origin with Host.
    proxy: { '/api': { target: 'http://localhost:3000' } },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    // Tests replace fetch with vi.stubGlobal; each test starts with the real one again.
    unstubGlobals: true,
    // The tests run as a device in New York, so a time shown in the device's zone instead of
    // Lisbon's fails them on every machine, one in Lisbon included.
    env: { TZ: 'America/New_York' },
  },
});
