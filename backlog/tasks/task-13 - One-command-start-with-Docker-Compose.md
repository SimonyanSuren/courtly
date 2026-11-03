---
id: TASK-13
title: One-command start with Docker Compose
status: In Progress
assignee:
  - '@SimonyanSuren'
  - '@claude'
created_date: '2026-11-01T23:42:00Z'
updated_date: '2026-11-03T23:25:00Z'
labels:
  - infra
dependencies:
  - TASK-9
  - TASK-10
priority: high
type: chore
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Running the project must take one command from a fresh clone, on a machine that has only Docker. If the stack does not come up, nothing else in the project can be tried.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 From a fresh clone, `docker compose up` starts the database, applies migrations, seeds the data and serves the API and the web app, with no other steps
- [x] #2 Services start in dependency order using health checks, so the API never starts against a database that is not ready
- [x] #3 Production images contain no devDependencies and run as a non-root user
- [x] #4 Restarting the stack keeps the data and does not duplicate the seed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The API and the web app are in place: apps/api/Dockerfile and apps/web/Dockerfile, and Compose services postgres, migrate (one-off), api and web, gated by health checks. Still to add: the seed service.

Seed service added (TASK-9). Verified with a separate Compose project from the working tree: postgres healthy, then migrate and seed exited 0, then api and web healthy; seeded data served through nginx. down and up again: the seed skipped, counts unchanged (3 users, 5 courts, 15 bookings). Images: the API runs as node (uid 1000) with no dev packages in /app/node_modules; the web app runs as nginx (uid 101) serving static files only. docker compose restart ignores the start order, so migrate and seed can fail while PostgreSQL restarts; restart with down and up. Criterion 1 waits for CI's stack job, which starts from a fresh checkout.
<!-- SECTION:NOTES:END -->
