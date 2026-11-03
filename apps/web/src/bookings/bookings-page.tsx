import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Stack,
  Table,
  Text,
  Title,
  VisuallyHidden,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useId, useState } from 'react';

import { errorMessage } from '../api';
import { formatDate, formatPrice, formatTimeRange } from '../format';
import { type Booking, describeBooking, useCancelBooking, useMyBookings } from './bookings';

/** The same rule as the server's: a confirmed booking, up to and including cancellableUntil. */
function canCancel(booking: Booking, now: number): boolean {
  return booking.status === 'confirmed' && now <= Date.parse(booking.cancellableUntil);
}

function BookingTable({
  title,
  bookings,
  now,
  onCancel,
}: Readonly<{
  title: string;
  bookings: Booking[];
  now: number;
  onCancel: (booking: Booking) => void;
}>): React.JSX.Element {
  const headingId = useId();

  return (
    <Stack gap="xs">
      <Title order={2} id={headingId}>
        {title}
      </Title>
      {bookings.length === 0 ? (
        <Text c="dimmed">No {title.toLowerCase()} bookings.</Text>
      ) : (
        // On a phone the table scrolls sideways instead of squeezing its columns.
        <Table.ScrollContainer minWidth={640} type="native">
          <Table aria-labelledby={headingId}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Court</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th>Time</Table.Th>
                <Table.Th>Price</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>
                  <VisuallyHidden>Action</VisuallyHidden>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {bookings.map((booking) => (
                <Table.Tr key={booking.id}>
                  <Table.Td>{booking.court.name}</Table.Td>
                  <Table.Td>{formatDate(booking.startsAt)}</Table.Td>
                  <Table.Td>{formatTimeRange(booking.startsAt, booking.endsAt)}</Table.Td>
                  <Table.Td>{formatPrice(booking.priceCents)}</Table.Td>
                  <Table.Td>
                    {booking.status === 'confirmed' ? (
                      <Badge color="green" variant="light">
                        Confirmed
                      </Badge>
                    ) : (
                      <Badge color="gray" variant="light">
                        Cancelled
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {canCancel(booking, now) && (
                      <Button
                        size="xs"
                        color="red"
                        variant="light"
                        aria-label={`Cancel ${describeBooking(booking)}`}
                        onClick={() => {
                          onCancel(booking);
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  );
}

export function BookingsPage(): React.JSX.Element {
  const bookings = useMyBookings();
  const cancellation = useCancelBooking();
  // The booking outlives the modal, so the modal keeps its content while it fades out.
  const [toCancel, setToCancel] = useState<Booking>();
  const [isModalOpen, modal] = useDisclosure(false);

  function openCancellation(booking: Booking): void {
    setToCancel(booking);
    modal.open();
  }

  function renderBookings(): React.ReactNode {
    if (bookings.isPending) {
      return <Loader />;
    }

    if (bookings.isError) {
      return <Alert color="red">{errorMessage(bookings.error)}</Alert>;
    }

    // The moment the list arrived, not the moment of rendering, which must stay free of side
    // effects. The list refetches whenever the page opens or regains focus, and the server
    // enforces the window anyway.
    const now = bookings.dataUpdatedAt;

    return (
      <>
        <BookingTable
          title="Upcoming"
          bookings={bookings.data.upcoming}
          now={now}
          onCancel={openCancellation}
        />
        <BookingTable
          title="Past"
          bookings={bookings.data.past}
          now={now}
          onCancel={openCancellation}
        />
      </>
    );
  }

  return (
    <Stack>
      <Title>My bookings</Title>
      {cancellation.isSuccess && (
        <Alert
          color="green"
          role="status"
          withCloseButton
          closeButtonLabel="Dismiss"
          onClose={() => {
            cancellation.reset();
          }}
        >
          Cancelled {describeBooking(cancellation.data)}.
        </Alert>
      )}
      {cancellation.isError && (
        <Alert
          color="red"
          withCloseButton
          closeButtonLabel="Dismiss"
          onClose={() => {
            cancellation.reset();
          }}
        >
          {errorMessage(cancellation.error)}
        </Alert>
      )}
      {renderBookings()}
      <Modal opened={isModalOpen} onClose={modal.close} title="Cancel this booking?">
        {toCancel && (
          <Stack>
            <Text>{describeBooking(toCancel)}</Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={modal.close}>
                Keep it
              </Button>
              <Button
                color="red"
                loading={cancellation.isPending}
                onClick={() => {
                  cancellation.mutate(toCancel.id, { onSettled: modal.close });
                }}
              >
                Cancel booking
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
