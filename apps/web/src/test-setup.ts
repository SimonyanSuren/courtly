import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// Browser features jsdom lacks and Mantine uses, each standing in for a screen that lays nothing
// out. Stubbed before every test: the config's unstubGlobals restores the real globals after each.
beforeEach(() => {
  // Mantine asks a media query for the preferred color scheme. This one never matches: a screen
  // in light mode.
  vi.stubGlobal('matchMedia', (media: string) => ({
    media,
    matches: false,
    addEventListener: (): void => undefined,
    removeEventListener: (): void => undefined,
  }));
  // The scroll area in a select's list watches its size. Nothing has a size, so this one never
  // reports.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = (): void => undefined;
      unobserve = (): void => undefined;
      disconnect = (): void => undefined;
    },
  );
});

afterEach(() => {
  // Testing Library unmounts after each test by itself only when the test functions are globals;
  // here they are imported.
  cleanup();
  // A test that fixes the clock leaves the next one the real time.
  vi.useRealTimers();
});

// A select scrolls its chosen option into view when its list opens; here there is nothing to
// scroll. Not a global, so it stays for the whole run.
Element.prototype.scrollIntoView = (): void => undefined;
