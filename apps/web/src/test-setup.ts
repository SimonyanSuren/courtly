import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library unmounts after each test by itself only when the test functions are globals;
// here they are imported.
afterEach(() => {
  cleanup();
});

// jsdom has no media queries, and Mantine asks one for the preferred color scheme. This one never
// matches: a screen in light mode.
Object.defineProperty(globalThis, 'matchMedia', {
  value: (media: string) => ({
    media,
    matches: false,
    addEventListener: (): void => undefined,
    removeEventListener: (): void => undefined,
  }),
});
