---
id: TASK-3
title: PostgreSQL connection and a health check
status: Done
assignee:
  - '@SimonyanSuren'
  - '@claude'
created_date: '2026-11-01T23:42:00Z'
updated_date: '2026-11-02T16:59:00Z'
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
- [x] #1 A local PostgreSQL 18 runs with Docker Compose, and the API connects to it through the configured database URL
- [x] #2 `GET /api/health` answers 200 when the database responds and 503 when it does not, without login
- [x] #3 Backend tests run against a real PostgreSQL started for the test run and reached through DATABASE_URL
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. compose.yaml with a PostgreSQL 18.6 service (health-checked; volume at /var/lib/postgresql, the PostgreSQL 18 image layout).
2. DATABASE_URL joins the validated environment and .env.example.
3. A global DatabaseModule provides a pg Pool and a Drizzle instance; the pool has a connection timeout and closes on shutdown.
4. GET /api/health runs SELECT 1: 200 when the database answers, 503 Problem Details when it does not.
5. Tests: Jest global setup starts PostgreSQL 18.6 with Testcontainers; tests reach it through DATABASE_URL.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Migrations moved to TASK-4: drizzle-kit needs a schema file, and the first table (users) arrives in TASK-4. Generating migrations now would need a placeholder schema; resetting data before each test needs tables. Both criteria now live in TASK-4.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
compose.yaml runs PostgreSQL 18.6 as service `postgres`: port bound to 127.0.0.1, volume at /var/lib/postgresql (the PostgreSQL 18 layout), TCP health check. Settings are registerAs namespaces, each owning and validating its variables with Zod through defineConfig(): http (PORT) and database (DATABASE_URL, DATABASE_POOL_MAX, DATABASE_CONNECTION_TIMEOUT_MS, DATABASE_STATEMENT_TIMEOUT_MS); an invalid one stops the start with an error naming it. pool.ts creates the one pg Pool with those limits, a 60 s idle-in-transaction timeout and application_name courtly-api; DatabaseModule provides it under the Pool class, puts Drizzle on top and closes it on shutdown. GET /api/health runs SELECT 1: 200 when the database answers, 503 Problem Details when it does not. Tests: Jest global setup starts PostgreSQL 18.6 with Testcontainers; createTestApp() boots the app as main.ts does. Bug found while verifying: a dropped idle connection made pg emit an unhandled error event and the API exited; the pool now logs a warning, and a regression test fails without the fix. Verified: 30 tests (including the session limits applied and a slow statement cancelled), and the built API against Compose answering 200, 503 with the database stopped, then 200 again. Migrations moved to TASK-4 (see notes).
<!-- SECTION:FINAL_SUMMARY:END -->
