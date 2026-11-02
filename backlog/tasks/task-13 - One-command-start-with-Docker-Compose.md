---
id: TASK-13
title: One-command start with Docker Compose
status: In Progress
assignee:
  - '@SimonyanSuren'
  - '@claude'
created_date: '2026-11-01T23:42:00Z'
updated_date: '2026-11-02T21:41:00Z'
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
- [ ] #2 Services start in dependency order using health checks, so the API never starts against a database that is not ready
- [ ] #3 Production images contain no devDependencies and run as a non-root user
- [ ] #4 Restarting the stack keeps the data and does not duplicate the seed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The API part is in place: apps/api/Dockerfile and Compose services postgres, migrate (one-off) and api, gated by health checks. Still to add: the seed service and the web app's image and service.
<!-- SECTION:NOTES:END -->
