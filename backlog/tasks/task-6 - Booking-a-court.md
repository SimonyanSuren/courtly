---
id: TASK-6
title: Booking a court
status: Done
assignee:
  - '@SimonyanSuren'
  - '@claude'
created_date: '2026-11-01T23:42:00Z'
updated_date: '2026-11-03T22:44:00Z'
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
- [x] #1 A user books an active court for 1 or 2 consecutive hours, starting on the hour and ending within the court's opening hours; anything else is rejected with a clear error
- [x] #2 No two confirmed bookings of the same court overlap, enforced by a database constraint: of two simultaneous requests for the same slot, exactly one succeeds and the other gets 409
- [x] #3 A booking that would start in the past is rejected
- [x] #4 A user can cancel their own booking up to and including exactly 2 hours before it starts; later cancellations are rejected with a clear error, and other users' bookings cannot be cancelled
- [x] #5 A cancelled booking frees its slot for new bookings
- [x] #6 A user sees their own bookings, split into upcoming and past
- [x] #7 Each booking keeps the price it was booked at, so later price changes do not alter it
- [x] #8 Backend tests cover double-booking prevention with concurrent requests, the cancellation window at its exact boundary, and opening-hours validation
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The booking and cancellation rules exist as pure functions: checkBooking (bookings/domain/booking.ts) and canCancel (bookings/domain/cancellation.ts). The service turns their result into an ApiError; overlaps stay a database constraint.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bookings of 1 or 2 hours on the hour within opening hours, refused when started; a PostgreSQL exclusion constraint on confirmed bookings makes overlaps impossible, answered with 409 SLOT_TAKEN. Cancelling up to exactly 2 hours before the start is a conditional update; another user's booking answers 404. Bookings keep their price; GET /api/bookings splits upcoming and past. The service works in Temporal values and dto/responses.ts writes the JSON. Verified by test/bookings.spec.ts (forced overlaps on two connections, commit and rollback, the cancellation boundary to the millisecond), bookings.schema.spec.ts and the domain unit tests; mutation checks removing the constraint, its WHERE, its bounds or the conditional cancel each fail a test.
<!-- SECTION:FINAL_SUMMARY:END -->
