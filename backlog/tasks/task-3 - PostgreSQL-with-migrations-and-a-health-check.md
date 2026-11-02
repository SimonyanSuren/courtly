---
id: TASK-3
title: PostgreSQL with migrations and a health check
status: To Do
assignee: []
created_date: '2026-11-01T23:42:00Z'
labels:
  - api
  - infra
dependencies:
  - TASK-2
priority: high
type: feature
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The booking guarantees rest on database constraints, so PostgreSQL is part of the design, not just storage. Schema changes must be reviewable and repeatable, and tests must run against the real database: a mocked one cannot prove that a constraint holds.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A local PostgreSQL 18 runs with Docker Compose, and the API connects to it through the configured database URL
- [ ] #2 Schema changes are versioned SQL migrations generated from the Drizzle schema and applied with one command
- [ ] #3 `GET /api/health` answers 200 when the database responds and 503 when it does not, without login
- [ ] #4 Backend tests run against a real PostgreSQL with migrations applied, and each test starts from known data
<!-- AC:END -->
