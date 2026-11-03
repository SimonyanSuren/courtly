---
id: TASK-5
title: Court management
status: Done
assignee:
  - '@SimonyanSuren'
  - '@claude'
created_date: '2026-11-01T23:42:00Z'
updated_date: '2026-11-03T22:44:00Z'
labels:
  - api
dependencies:
  - TASK-4
priority: high
type: feature
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Admins maintain the facility's courts. Courts are never deleted: bookings reference them, and their booking history must survive deactivation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A court has a name, a sport (for example padel or tennis), an hourly price, opening hours and an active flag
- [x] #2 Admins can create and edit courts, including the active flag; invalid data gets 400: an empty name, a price that is not positive, or opening hours that are not whole hours between 00:00 and 24:00 with opening before closing
- [x] #3 Deactivating a court keeps all of its bookings, past and future; courts cannot be deleted
- [x] #4 Users see only active courts; admins see all courts
- [x] #5 Prices are stored and returned as integer cents, never as floating-point numbers
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The courts API is in place and tested over HTTP. Criterion 3 (deactivating keeps a court's bookings) can be shown once bookings reference courts, in TASK-6.

Criterion 3 shown with bookings: test/bookings.spec.ts ('keeps the bookings of a court that is deactivated, which takes no new ones') and bookings.schema.spec.ts ('refuses to delete a court that has bookings'); test/courts.spec.ts has no DELETE route.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Courts with a name unique ignoring case, a sport, an hourly price in integer cents, whole opening hours and an active flag. Admins create, edit, deactivate and reactivate them; users see active courts only, and an inactive court answers 404 to them. The database checks every limit the request validation checks. Verified by test/courts.spec.ts and courts.schema.spec.ts over a real PostgreSQL, plus the bookings tests for deactivation. Follow-up: two simultaneous edits of one court's hours answer 500 instead of 400 (fix planned).
<!-- SECTION:FINAL_SUMMARY:END -->
