---
id: TASK-9
title: Seed data for a ready-to-try demo
status: Done
assignee: []
created_date: '2026-11-01T23:42:00Z'
updated_date: '2026-11-03T23:25:00Z'
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
- [x] #1 The seed creates at least 3 courts of different sports, 2 users and 1 admin, and a handful of bookings: past, upcoming and cancelled
- [x] #2 Seeded bookings are placed relative to the current date, so upcoming bookings exist whenever the demo runs
- [x] #3 Running the seed again does not duplicate data
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A one-off seed (src/seed.ts, npm run db:seed, the compose seed service) fills a database with no users with 3 accounts (password courtly-demo), 5 courts of 4 sports with one inactive, and 13 bookings on Lisbon days from a week ago to 2 days ahead, past, upcoming and cancelled. Each booking passes checkBooking at the moment it was made. One transaction; any existing user makes it change nothing. Verified by test/seed.spec.ts (32 tests, at 8 moments including the days the clocks change, reruns, all-or-nothing) and in Docker: seeded on the first start, skipped on the next, counts unchanged. Follow-up: an old volume keeps its old dates; docker compose down -v reseeds.
<!-- SECTION:FINAL_SUMMARY:END -->
