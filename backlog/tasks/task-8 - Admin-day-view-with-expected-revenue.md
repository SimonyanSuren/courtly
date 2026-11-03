---
id: TASK-8
title: Admin day view with expected revenue
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
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Admins need one view of a day across all courts: how busy the facility is and what the day should earn.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 For a date, admins get every booking across all courts, including inactive ones, with court, user, time and status
- [x] #2 The total expected revenue is the sum of the day's confirmed bookings at their booked prices; cancelled bookings are listed but not counted
- [x] #3 The day is a calendar day in Europe/Lisbon
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
GET /api/admin/bookings?date= lists every booking that starts on a Lisbon calendar day, at every court including inactive ones, with court, user, time, price and status, by court name and start. expectedRevenueCents sums the confirmed ones at their booked prices, summed from the listed rows. Verified by test/day-view.spec.ts (including the 25-hour day) and revenue.spec.ts.
<!-- SECTION:FINAL_SUMMARY:END -->
