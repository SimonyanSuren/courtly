import { Paper } from '@mantine/core';

/** A table on a white card, so it stands out from the grey page around it. */
export function TablePanel({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    // Clipped, so the highlighted last row keeps the card's rounded corners.
    <Paper withBorder style={{ overflow: 'hidden' }}>
      {children}
    </Paper>
  );
}
