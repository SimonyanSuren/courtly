---
id: TASK-11
title: Booking screens for users
status: Done
assignee:
  - '@SimonyanSuren'
  - '@claude'
created_date: '2026-11-01T23:42:00Z'
updated_date: '2026-11-04T01:25:00Z'
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
- [x] #1 A user browses active courts with their sport, hourly price and opening hours
- [x] #2 After choosing a court and a date, the user sees the day's slots marked available or taken and books 1 or 2 consecutive hours
- [x] #3 When a booking fails, for example because the slot was just taken, the user sees why and the slots refresh
- [x] #4 The user sees their bookings as upcoming and past, and can cancel an upcoming one while the 2-hour window allows it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The screens are built against docs/api.md and tested with stubbed API responses. They work end to end once TASK-5, TASK-6 and TASK-7 provide the routes.

Checked in Chrome against a fresh seeded stack (docker compose, separate project on port 18080), 4 Nov 2026. Ana saw the 4 active courts with sport, price and hours; booked Padel 2 10:00 for 2 hours at €44.00, after which both slots showed TAKEN; with 12:00 booked by Rui through the API behind her open page, her booking got 'Someone else booked this court for that time.' and the slots refreshed to TAKEN; My bookings split upcoming and past (the inactive court's past booking keeps its name); cancelling showed a confirmation and removed the Cancel button. Hiding Cancel after cancellableUntil is covered by bookings-page.spec.tsx.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Users browse active courts, pick a date to see slots marked available, taken or started, and book 1 or 2 hours in a confirmation dialog with the price. A refused booking shows the API's sentence and refreshes the slots. My bookings lists upcoming and past, with Cancel offered until cancellableUntil. Verified in a real browser and by the web tests.
<!-- SECTION:FINAL_SUMMARY:END -->
