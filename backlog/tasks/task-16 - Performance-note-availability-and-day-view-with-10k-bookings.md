---
id: TASK-16
title: 'Performance note: availability and day view with 10k+ bookings'
status: Done
assignee: []
created_date: '2026-11-04T01:26:00Z'
updated_date: '2026-11-04T02:10:00Z'
labels:
  - api
  - database
dependencies: []
priority: medium
type: feature
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Show with measured numbers that the two read queries that grow with the number of bookings, a court's availability for a date and the admin day view, stay fast with a large booking history, and explain which index serves each.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A repeatable command fills a database with at least 10,000 bookings (and larger sizes), spread over courts and days, without touching the demo data
- [x] #2 The availability and day-view queries are measured as the API runs them, with timings per data size and their query plans
- [x] #3 Each query is served by an index, and any query change keeps every existing test passing
- [x] #4 A document in the repository records the method, the numbers and the plans
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Measured on a laptop (i5-1135G7, PostgreSQL 18.6 in Docker). Availability before the rewrite: 1.60, 4.32 and 51.70 ms median at 10k, 100k and 1M (the GiST index matched only court_id, then filtered 84,610 rows at 1M); after: 1.04, 0.90 and 1.04 ms, reading the day's 8 rows. Day view: 3.9 to 4.2 ms at every size on bookings_starts_at_index. The perf run asserts each Index Cond and that availability returns what the plain comparison selects. bookings.repository.spec.ts pins the day's edges; the '[]' bound mutation now fails it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
npm run perf -w apps/api fills its own PostgreSQL with 10k, 100k and 1M synthetic bookings and times availability and the day view as the repository sends them, with plans; docs/performance.md records method and numbers. Availability's condition now uses the exclusion constraint's tstzrange expression, so its GiST index finds the court and the day together: about 1 ms at every size instead of 51.7 ms at 1M. The day view was already flat on the starts_at index. No index added.
<!-- SECTION:FINAL_SUMMARY:END -->
