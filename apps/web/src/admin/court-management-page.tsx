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
import { useState } from 'react';

import { errorMessage } from '../api';
import { type Court, useCourts } from '../courts/courts';
import { formatHour, formatPrice } from '../format';
import { CourtForm } from './court-form';
import { useSetCourtActive } from './court-management';

export function CourtManagementPage(): React.JSX.Element {
  const courts = useCourts();
  const activation = useSetCourtActive();
  // The court outlives the modal, so the modal keeps its title while it fades out.
  const [editing, setEditing] = useState<Court>();
  const [isFormOpen, form] = useDisclosure(false);

  function openForm(court: Court | undefined): void {
    setEditing(court);
    form.open();
  }

  function renderCourts(): React.ReactNode {
    if (courts.isPending) {
      return <Loader />;
    }

    if (courts.isError) {
      return <Alert color="red">{errorMessage(courts.error)}</Alert>;
    }

    if (courts.data.length === 0) {
      return <Text>There are no courts yet.</Text>;
    }

    return (
      // On a phone the table scrolls sideways instead of squeezing its columns.
      <Table.ScrollContainer minWidth={720} type="native">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Sport</Table.Th>
              <Table.Th>Price per hour</Table.Th>
              <Table.Th>Opening hours</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>
                <VisuallyHidden>Actions</VisuallyHidden>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {courts.data.map((court) => {
              const action = court.active ? 'Deactivate' : 'Reactivate';

              return (
                <Table.Tr key={court.id}>
                  <Table.Td>{court.name}</Table.Td>
                  <Table.Td>{court.sport}</Table.Td>
                  <Table.Td>{formatPrice(court.hourlyPriceCents)}</Table.Td>
                  <Table.Td>
                    {formatHour(court.openingHour)}–{formatHour(court.closingHour)}
                  </Table.Td>
                  <Table.Td>
                    {court.active ? (
                      <Badge color="green" variant="light">
                        Active
                      </Badge>
                    ) : (
                      <Badge color="gray" variant="light">
                        Inactive
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Button
                        size="xs"
                        variant="default"
                        aria-label={`Edit ${court.name}`}
                        onClick={() => {
                          openForm(court);
                        }}
                      >
                        Edit
                      </Button>
                      {/* No confirmation: one click undoes it, and bookings are kept either way. */}
                      <Button
                        size="xs"
                        variant="light"
                        color={court.active ? 'red' : 'blue'}
                        aria-label={`${action} ${court.name}`}
                        loading={activation.isPending && activation.variables.courtId === court.id}
                        onClick={() => {
                          activation.mutate({ courtId: court.id, active: !court.active });
                        }}
                      >
                        {action}
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    );
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title>Courts</Title>
        <Button
          onClick={() => {
            openForm(undefined);
          }}
        >
          Add court
        </Button>
      </Group>
      {activation.isError && (
        <Alert
          color="red"
          withCloseButton
          closeButtonLabel="Dismiss"
          onClose={() => {
            activation.reset();
          }}
        >
          {errorMessage(activation.error)}
        </Alert>
      )}
      {renderCourts()}
      <Modal
        opened={isFormOpen}
        onClose={form.close}
        title={editing ? `Edit ${editing.name}` : 'Add a court'}
      >
        <CourtForm
          // Another court gets a fresh form, even when the modal reopens before it has faded out.
          key={editing?.id ?? 'new'}
          court={editing}
          onSaved={form.close}
          onCancel={form.close}
        />
      </Modal>
    </Stack>
  );
}
