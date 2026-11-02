---
id: TASK-9
title: Seed data for a ready-to-try demo
status: To Do
assignee: []
created_date: '2026-11-01T23:42:00Z'
labels:
  - api
dependencies:
  - TASK-6
priority: high
type: feature
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Anyone starting the app must be able to log in and see realistic data right away, without creating anything first.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The seed creates at least 3 courts of different sports, 2 users and 1 admin, and a handful of bookings: past, upcoming and cancelled
- [ ] #2 Seeded bookings are placed relative to the current date, so upcoming bookings exist whenever the demo runs
- [ ] #3 Running the seed again does not duplicate data
<!-- AC:END -->
