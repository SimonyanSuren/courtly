import { z } from 'zod';

import { courtSchema } from '../../courts/dto/court.response';
import { type Availability } from '../bookings.service';
import { SlotStatus } from '../domain/slots';
import { facilityTime, moment } from './moment';

const slotSchema = z
  .object({
    startsAt: moment,
    endsAt: moment,
    status: z.enum(SlotStatus).meta({
      description:
        '`started`: it starts at or before now, booked or not; `taken`: a confirmed booking covers it.',
    }),
  })
  .meta({ id: 'Slot' });

export const availabilitySchema = z.object({
  court: courtSchema,
  date: z.iso.date(),
  slots: z.array(slotSchema),
});

export type AvailabilityResponse = z.output<typeof availabilitySchema>;

export function toAvailabilityResponse({ court, date, slots }: Availability): AvailabilityResponse {
  return {
    court,
    date: date.toString(),
    slots: slots.map(({ start, end, status }) => ({
      startsAt: facilityTime(start),
      endsAt: facilityTime(end),
      status,
    })),
  };
}
