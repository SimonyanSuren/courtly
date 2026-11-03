---
id: TASK-11
title: Booking screens for users
status: In Progress
assignee:
  - '@SimonyanSuren'
  - '@claude'
created_date: '2026-11-01T23:42:00Z'
updated_date: '2026-11-03T00:09:00Z'
labels:
  - web
dependencies:
  - TASK-10
  - TASK-7
priority: high
type: feature
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Users need to get from choosing a court to a confirmed booking, and to manage what they booked.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A user browses active courts with their sport, hourly price and opening hours
- [ ] #2 After choosing a court and a date, the user sees the day's slots marked available or taken and books 1 or 2 consecutive hours
- [ ] #3 When a booking fails, for example because the slot was just taken, the user sees why and the slots refresh
- [ ] #4 The user sees their bookings as upcoming and past, and can cancel an upcoming one while the 2-hour window allows it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The screens are built against docs/api.md and tested with stubbed API responses. They work end to end once TASK-5, TASK-6 and TASK-7 provide the routes.
<!-- SECTION:NOTES:END -->
