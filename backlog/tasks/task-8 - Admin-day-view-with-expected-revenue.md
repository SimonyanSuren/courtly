---
id: TASK-8
title: Admin day view with expected revenue
status: To Do
assignee: []
created_date: '2026-11-01T23:42:00Z'
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
- [ ] #1 For a date, admins get every booking across all courts, including inactive ones, with court, user, time and status
- [ ] #2 The total expected revenue is the sum of the day's confirmed bookings at their booked prices; cancelled bookings are listed but not counted
- [ ] #3 The day is a calendar day in Europe/Lisbon
<!-- AC:END -->
