---
id: TASK-7
title: Court availability for a date
status: To Do
assignee: []
created_date: '2026-11-01T23:42:00Z'
updated_date: '2026-11-02T21:42:00Z'
labels:
  - api
dependencies:
  - TASK-6
priority: high
type: feature
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Before booking, a user needs to see which hours of a day are free. The answer must agree with what the booking rules accept; otherwise users pick slots that then fail.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 For a court and a date, the API returns the day's 1-hour slots within the court's opening hours, each marked available or taken
- [ ] #2 A slot is taken when a confirmed booking covers it; cancelled bookings take no slots
- [ ] #3 Slots that have already started are not offered as available
- [ ] #4 Dates are calendar days in the facility's time zone (Europe/Lisbon), including the days the clocks change
- [ ] #5 Inactive courts have no availability for users
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
daySlots and hasStarted (bookings/domain/slots.ts) give a date's slots in Europe/Lisbon; availability marks each one taken or started.
<!-- SECTION:NOTES:END -->
