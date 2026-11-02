---
id: TASK-6
title: Booking a court
status: To Do
assignee: []
created_date: '2026-11-01T23:42:00Z'
updated_date: '2026-11-02T21:42:00Z'
labels:
  - api
dependencies:
  - TASK-5
priority: high
type: feature
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Booking is the core of the product and where its rules live. Double booking is the failure that matters most: two users submitting the same slot at the same instant must not both succeed, so the guarantee has to come from the database, not from a check-then-insert in application code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A user books an active court for 1 or 2 consecutive hours, starting on the hour and ending within the court's opening hours; anything else is rejected with a clear error
- [ ] #2 No two confirmed bookings of the same court overlap, enforced by a database constraint: of two simultaneous requests for the same slot, exactly one succeeds and the other gets 409
- [ ] #3 A booking that would start in the past is rejected
- [ ] #4 A user can cancel their own booking up to and including exactly 2 hours before it starts; later cancellations are rejected with a clear error, and other users' bookings cannot be cancelled
- [ ] #5 A cancelled booking frees its slot for new bookings
- [ ] #6 A user sees their own bookings, split into upcoming and past
- [ ] #7 Each booking keeps the price it was booked at, so later price changes do not alter it
- [ ] #8 Backend tests cover double-booking prevention with concurrent requests, the cancellation window at its exact boundary, and opening-hours validation
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The booking and cancellation rules exist as pure functions: checkBooking (bookings/domain/booking.ts) and canCancel (bookings/domain/cancellation.ts). The service turns their result into an ApiError; overlaps stay a database constraint.
<!-- SECTION:NOTES:END -->
