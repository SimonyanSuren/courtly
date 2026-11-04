import { createTheme } from '@mantine/core';

/** Mantine's defaults with one accent colour, softer corners and smaller page titles. */
export const theme = createTheme({
  primaryColor: 'teal',
  defaultRadius: 'md',
  headings: { sizes: { h1: { fontSize: '1.75rem' } } },
});
