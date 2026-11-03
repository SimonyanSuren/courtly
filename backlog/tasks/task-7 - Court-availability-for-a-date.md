---
id: TASK-7
title: Court availability for a date
status: Done
assignee:
  - '@SimonyanSuren'
  - '@claude'
created_date: '2026-11-01T23:42:00Z'
updated_date: '2026-11-03T22:44:00Z'
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
- [x] #1 For a court and a date, the API returns the day's 1-hour slots within the court's opening hours, each marked available or taken
- [x] #2 A slot is taken when a confirmed booking covers it; cancelled bookings take no slots
- [x] #3 Slots that have already started are not offered as available
- [x] #4 Dates are calendar days in the facility's time zone (Europe/Lisbon), including the days the clocks change
- [x] #5 Inactive courts have no availability for users
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
daySlots and hasStarted (bookings/domain/slots.ts) give a date's slots in Europe/Lisbon; availability marks each one taken or started.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
GET /api/courts/:id/availability?date= lists the day's 1-hour slots from opening to closing, each available, taken by a confirmed booking or started. The slots come from the same list booking checks against, so both agree. Days are Lisbon calendar days, with 23 or 25 slots when the clocks change. Inactive courts answer 404 to users. Verified by test/availability.spec.ts and slots.spec.ts.
<!-- SECTION:FINAL_SUMMARY:END -->
