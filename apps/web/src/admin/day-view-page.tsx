import { Alert, Badge, Loader, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { useSearchParams } from 'react-router';

import { errorMessage } from '../api';
import { formatPrice, formatTimeRange, today } from '../format';
import { type AdminBooking, useDayView } from './day-view';

function BookingTable({ bookings }: Readonly<{ bookings: AdminBooking[] }>): React.JSX.Element {
  return (
    // On a phone the table scrolls sideways instead of squeezing its columns.
    <Table.ScrollContainer minWidth={720} type="native">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Court</Table.Th>
            <Table.Th>Time</Table.Th>
            <Table.Th>Customer</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th>Price</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {bookings.map((booking) => {
            const isCancelled = booking.status === 'cancelled';

            return (
              <Table.Tr key={booking.id}>
                <Table.Td>{booking.court.name}</Table.Td>
                <Table.Td>{formatTimeRange(booking.startsAt, booking.endsAt)}</Table.Td>
                <Table.Td>{booking.user.name}</Table.Td>
                <Table.Td>{booking.user.email}</Table.Td>
                <Table.Td>{formatPrice(booking.priceCents)}</Table.Td>
                <Table.Td>
                  {isCancelled ? (
                    <Badge color="gray" variant="light">
                      Cancelled
                    </Badge>
                  ) : (
                    <Badge color="green" variant="light">
                      Confirmed
                    </Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

export function DayViewPage(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  // The day is in the address, so a reload or a shared link shows the same one.
  const date = searchParams.get('date') ?? today();
  const dayView = useDayView(date);

  function renderDay(): React.ReactNode {
    if (dayView.isPending) {
      return <Loader />;
    }

    if (dayView.isError) {
      return <Alert color="red">{errorMessage(dayView.error)}</Alert>;
    }

    const { bookings, expectedRevenueCents } = dayView.data;

    return (
      <>
        {/* The server's own sum, so the rule for what counts lives in one place. */}
        <Text fw={700}>Expected revenue: {formatPrice(expectedRevenueCents)}</Text>
        {bookings.length === 0 ? (
          <Text c="dimmed">No bookings on this day.</Text>
        ) : (
          <BookingTable bookings={bookings} />
        )}
      </>
    );
  }

  return (
    <Stack>
      <Title>Day view</Title>
      <TextInput
        type="date"
        label="Date"
        maw={240}
        value={date}
        onChange={(event) => {
          const { value } = event.currentTarget;

          // A date input reports '' while a typed date is incomplete; the last full one stays.
          if (value) {
            // Replaced, not pushed, so Back leaves the page instead of stepping through the days.
            setSearchParams({ date: value }, { replace: true });
          }
        }}
      />
      {renderDay()}
    </Stack>
  );
}
