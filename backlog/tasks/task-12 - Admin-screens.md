---
id: TASK-12
title: Admin screens
status: In Progress
assignee:
  - '@SimonyanSuren'
  - '@claude'
created_date: '2026-11-01T23:42:00Z'
updated_date: '2026-11-03T14:11:00Z'
labels:
  - web
dependencies:
  - TASK-10
  - TASK-5
  - TASK-8
priority: high
type: feature
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Admins manage courts and follow each day's bookings from the browser.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Admins create, edit, deactivate and reactivate courts, with validation errors shown next to the fields
- [ ] #2 Admins pick a date and see all bookings for it across courts, with the total expected revenue
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The screens are built against docs/api.md and tested with stubbed API responses. Court management works end to end with the courts API; the day view does once TASK-8 provides its route.
<!-- SECTION:NOTES:END -->
