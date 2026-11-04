---
id: TASK-15
title: README
status: Done
assignee:
  - '@SimonyanSuren'
created_date: '2026-11-01T23:42:00Z'
updated_date: '2026-11-04T13:57:00Z'
labels:
  - docs
dependencies:
  - TASK-13
priority: high
type: docs
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The README is the entry point for anyone running or reviewing the project. It is written by Suren.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 How to run: clone, `docker compose up`, then the URLs and the seeded logins
- [x] #2 Stack choices with their trade-offs, 2-3 sentences each: React vs Next.js, Express vs NestJS, and the database
- [x] #3 How double booking is prevented under concurrency: the mechanism and where it lives
- [x] #4 Specific next steps with more time
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
README covers how to run (clone, docker compose up, the URLs and the demo logins), the stack choices as trade-offs (React with Vite vs Next.js, NestJS vs Express, PostgreSQL with Drizzle), how double booking is refused (the exclusion constraint, what happens to two requests at once, and the tests that force the race) and specific next steps, plus what the app does, the tests, performance, development and the layout. Its commands and URLs were checked on a fresh clone from GitHub.
<!-- SECTION:FINAL_SUMMARY:END -->
