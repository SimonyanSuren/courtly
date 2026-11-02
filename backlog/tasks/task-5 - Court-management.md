---
id: TASK-5
title: Court management
status: To Do
assignee: []
created_date: '2026-11-01T23:42:00Z'
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
- [ ] #1 A court has a name, a sport (for example padel or tennis), an hourly price, opening hours and an active flag
- [ ] #2 Admins can create and edit courts, including the active flag; invalid data gets 400: an empty name, a price that is not positive, or opening hours that are not whole hours between 00:00 and 24:00 with opening before closing
- [ ] #3 Deactivating a court keeps all of its bookings, past and future; courts cannot be deleted
- [ ] #4 Users see only active courts; admins see all courts
- [ ] #5 Prices are stored and returned as integer cents, never as floating-point numbers
<!-- AC:END -->
