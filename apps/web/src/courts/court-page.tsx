import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Radio,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  VisuallyHidden,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { errorMessage } from '../api';
import { describeBooking, useBookCourt } from '../bookings/bookings';
import { formatDate, formatHour, formatPrice, formatTimeRange, today } from '../format';
import { type Court, type Slot, useAvailability } from './courts';

const statuses: Record<Slot['status'], { label: string; color: string }> = {
  available: { label: 'Available', color: 'green' },
  taken: { label: 'Taken', color: 'red' },
  started: { label: 'Started', color: 'gray' },
};

/** The slot the user chose to book, as the page showed it then. */
interface Choice {
  court: Court;
  slot: Slot;
  /** The slot after it, if the court is still open then. */
  nextSlot: Slot | undefined;
}

function CourtDetails({ court }: Readonly<{ court: Court }>): React.JSX.Element {
  return (
    <Stack gap="xs">
      <Group>
        <Title>{court.name}</Title>
        <Badge variant="light">{court.sport}</Badge>
      </Group>
      <Text>
        {formatPrice(court.hourlyPriceCents)} per hour · Open {formatHour(court.openingHour)}–
        {formatHour(court.closingHour)}
      </Text>
    </Stack>
  );
}

function SlotTable({
  slots,
  onBook,
}: Readonly<{
  slots: Slot[];
  onBook: (slot: Slot, nextSlot: Slot | undefined) => void;
}>): React.JSX.Element {
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Time</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>
            <VisuallyHidden>Action</VisuallyHidden>
          </Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {slots.map((slot, index) => {
          const time = formatTimeRange(slot.startsAt, slot.endsAt);
          const status = statuses[slot.status];

          return (
            <Table.Tr key={slot.startsAt}>
              <Table.Td>{time}</Table.Td>
              <Table.Td>
                <Badge color={status.color} variant="light">
                  {status.label}
                </Badge>
              </Table.Td>
              <Table.Td>
                {slot.status === 'available' && (
                  <Button
                    size="xs"
                    aria-label={`Book ${time}`}
                    onClick={() => {
                      onBook(slot, slots[index + 1]);
                    }}
                  >
                    Book
                  </Button>
                )}
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}

function BookingModal({
  choice: { court, slot, nextSlot },
  opened,
  isPending,
  onClose,
  onConfirm,
}: Readonly<{
  choice: Choice;
  opened: boolean;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (hours: 1 | 2) => void;
}>): React.JSX.Element {
  const [chosenHours, setChosenHours] = useState<1 | 2>(1);

  // Two hours are two consecutive slots, so they are offered only when the next one is free too.
  const canBookTwoHours = nextSlot?.status === 'available';
  const isTwoHours = canBookTwoHours && chosenHours === 2;
  const hours = isTwoHours ? 2 : 1;
  const endsAt = isTwoHours ? nextSlot.endsAt : slot.endsAt;

  return (
    <Modal opened={opened} onClose={onClose} title="Confirm your booking">
      <Stack>
        <Text>
          {court.name} on {formatDate(slot.startsAt)}, {formatTimeRange(slot.startsAt, endsAt)}
        </Text>
        {canBookTwoHours ? (
          <Radio.Group
            label="Duration"
            value={String(hours)}
            onChange={(value) => {
              setChosenHours(value === '2' ? 2 : 1);
            }}
          >
            <Group mt="xs">
              <Radio value="1" label="1 hour" />
              <Radio value="2" label="2 hours" />
            </Group>
          </Radio.Group>
        ) : (
          <Text>Duration: 1 hour</Text>
        )}
        <Text fw={700}>Price: {formatPrice(court.hourlyPriceCents * hours)}</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Back
          </Button>
          <Button
            loading={isPending}
            onClick={() => {
              onConfirm(hours);
            }}
          >
            Confirm booking
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function CourtPage(): React.JSX.Element {
  // The route always has the court's id.
  const { courtId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  // The day is in the address, so a reload or a shared link shows the same one.
  const date = searchParams.get('date') ?? today();
  const availability = useAvailability(courtId, date);
  const booking = useBookCourt();
  // The choice outlives the modal, so the modal keeps its content while it fades out.
  const [choice, setChoice] = useState<Choice>();
  const [isModalOpen, modal] = useDisclosure(false);

  function renderSlots(): React.ReactNode {
    if (availability.isError) {
      return <Alert color="red">{errorMessage(availability.error)}</Alert>;
    }

    // The previous day's slots stay hidden while another day loads, so none is booked by mistake.
    if (availability.isPending || availability.isPlaceholderData) {
      return <Loader />;
    }

    const { court, slots } = availability.data;

    return (
      <SlotTable
        slots={slots}
        onBook={(slot, nextSlot) => {
          setChoice({ court, slot, nextSlot });
          modal.open();
        }}
      />
    );
  }

  return (
    <Stack>
      <Anchor component={Link} to="/courts">
        All courts
      </Anchor>
      {availability.data && <CourtDetails court={availability.data.court} />}
      <TextInput
        type="date"
        label="Date"
        maw={240}
        min={today()}
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
      {booking.isSuccess && (
        <Alert
          color="green"
          role="status"
          withCloseButton
          closeButtonLabel="Dismiss"
          onClose={() => {
            booking.reset();
          }}
        >
          Booked {describeBooking(booking.data)}, for {formatPrice(booking.data.priceCents)}.{' '}
          <Anchor component={Link} to="/bookings" inherit>
            See my bookings
          </Anchor>
        </Alert>
      )}
      {booking.isError && (
        <Alert
          color="red"
          withCloseButton
          closeButtonLabel="Dismiss"
          onClose={() => {
            booking.reset();
          }}
        >
          {errorMessage(booking.error)}
        </Alert>
      )}
      {renderSlots()}
      {choice && (
        <BookingModal
          // Another slot starts again from 1 hour.
          key={choice.slot.startsAt}
          choice={choice}
          opened={isModalOpen}
          isPending={booking.isPending}
          onClose={modal.close}
          onConfirm={(hours) => {
            booking.mutate(
              { courtId: choice.court.id, startsAt: choice.slot.startsAt, hours },
              { onSettled: modal.close },
            );
          }}
        />
      )}
    </Stack>
  );
}
