---
id: TASK-16
title: 'Performance note: availability and day view with 10k+ bookings'
status: To Do
assignee: []
created_date: '2026-11-04T01:26:00Z'
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
- [ ] #1 A repeatable command fills a database with at least 10,000 bookings (and larger sizes), spread over courts and days, without touching the demo data
- [ ] #2 The availability and day-view queries are measured as the API runs them, with timings per data size and their query plans
- [ ] #3 Each query is served by an index, and any query change keeps every existing test passing
- [ ] #4 A document in the repository records the method, the numbers and the plans
<!-- AC:END -->
