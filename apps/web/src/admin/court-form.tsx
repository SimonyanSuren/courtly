import { Alert, Button, Group, NativeSelect, Stack, TextInput } from '@mantine/core';
import { type SubmitEvent, useState } from 'react';

import { ApiError, errorMessage } from '../api';
import { type Court, type Sport, sports } from '../courts/courts';
import { formatHour } from '../format';
import { useSaveCourt } from './court-management';
import { centsToEuros, eurosToCents } from './price';

/** The body fields the form has an input for, by the names the API gives them in its errors. */
const fieldsWithInput = new Set([
  'name',
  'sport',
  'hourlyPriceCents',
  'openingHour',
  'closingHour',
]);

interface FormErrors {
  /** By body field, as the API names them. */
  byField: Readonly<Partial<Record<string, string>>>;
  /** Messages without an input of their own, for the alert above the form. */
  other: string[];
}

/** Places each message from the server once: next to its field if it has one, else in the alert. */
function formErrors(error: Error | null): FormErrors {
  if (!error) {
    return { byField: {}, other: [] };
  }

  if (error instanceof ApiError && error.code === 'COURT_NAME_TAKEN') {
    return { byField: { name: error.message }, other: [] };
  }

  const byField = error instanceof ApiError ? error.fieldErrors : {};
  // The error's own sentence; for invalid values, a summary of the messages at the fields.
  const other = [errorMessage(error)];

  for (const [path, message] of Object.entries(byField)) {
    if (message !== undefined && !fieldsWithInput.has(path)) {
      other.push(message);
    }
  }

  return { byField, other };
}

function hourOptions(first: number, last: number): Array<{ value: string; label: string }> {
  return Array.from({ length: last - first + 1 }, (_, index) => ({
    value: String(first + index),
    label: formatHour(first + index),
  }));
}

const openingHours = hourOptions(0, 23);
const closingHours = hourOptions(1, 24);

/** A form for a new court, or for an existing one's fields. */
export function CourtForm({
  court,
  onSaved,
  onCancel,
}: Readonly<{
  /** The court to edit; undefined for a new one. */
  court: Court | undefined;
  onSaved: () => void;
  onCancel: () => void;
}>): React.JSX.Element {
  const save = useSaveCourt();
  const [name, setName] = useState(court?.name ?? '');
  const [sport, setSport] = useState<Sport>(court?.sport ?? sports[0]);
  const [price, setPrice] = useState(court ? centsToEuros(court.hourlyPriceCents) : '');
  // A new court starts with common hours, for the admin to adjust.
  const [openingHour, setOpeningHour] = useState(String(court?.openingHour ?? 8));
  const [closingHour, setClosingHour] = useState(String(court?.closingHour ?? 22));
  const [priceError, setPriceError] = useState<string>();
  const errors = formErrors(save.error);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const hourlyPriceCents = eurosToCents(price);

    // Text that is not a price has no number to send; whether a number is allowed is the server's
    // call.
    if (hourlyPriceCents === undefined) {
      // The server's answer to the previous attempt no longer applies.
      save.reset();
      setPriceError('Enter the price in euros with up to 2 decimals, such as 15.10.');

      return;
    }

    setPriceError(undefined);
    save.mutate(
      {
        courtId: court?.id,
        fields: {
          name,
          sport,
          hourlyPriceCents,
          openingHour: Number(openingHour),
          closingHour: Number(closingHour),
        },
      },
      { onSuccess: onSaved },
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack>
        {errors.other.length > 0 && <Alert color="red">{errors.other.join(' ')}</Alert>}
        <TextInput
          label="Name"
          required
          value={name}
          onChange={(event) => {
            setName(event.currentTarget.value);
          }}
          error={errors.byField.name}
        />
        <NativeSelect
          label="Sport"
          data={sports}
          value={sport}
          onChange={(event) => {
            // The select offers only sports.
            setSport(event.currentTarget.value as Sport);
          }}
          error={errors.byField.sport}
        />
        <TextInput
          label="Price per hour (€)"
          required
          // A keypad with the device's decimal separator, a comma in Portugal.
          inputMode="decimal"
          value={price}
          onChange={(event) => {
            setPrice(event.currentTarget.value);
          }}
          error={priceError ?? errors.byField.hourlyPriceCents}
        />
        <Group grow align="flex-start">
          <NativeSelect
            label="Opening hour"
            data={openingHours}
            value={openingHour}
            onChange={(event) => {
              setOpeningHour(event.currentTarget.value);
            }}
            error={errors.byField.openingHour}
          />
          <NativeSelect
            label="Closing hour"
            data={closingHours}
            value={closingHour}
            onChange={(event) => {
              setClosingHour(event.currentTarget.value);
            }}
            error={errors.byField.closingHour}
          />
        </Group>
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            {court ? 'Save changes' : 'Add court'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
