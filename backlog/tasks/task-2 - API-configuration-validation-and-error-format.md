---
id: TASK-2
title: API configuration, validation and error format
status: In Progress
assignee:
  - '@SimonyanSuren'
  - '@claude'
created_date: '2026-11-01T23:42:00Z'
updated_date: '2026-11-02T00:48:00Z'
labels:
  - api
dependencies: []
priority: high
type: feature
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every endpoint needs validated settings and one consistent way to reject bad input and report errors. Settling this before the first feature lets the booking code focus on rules, and lets clients and tests rely on a single error shape.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Settings come from environment variables, validated once at startup; a missing or invalid one stops the start with an error that names it. Each later task adds the variables it uses
- [x] #2 `.env.example` lists every variable the API reads
- [ ] #3 Request bodies, route parameters and query strings are validated against schemas; invalid input gets 400 with the failing fields
- [ ] #4 Every error response, including validation errors, unknown routes and unexpected failures, has the same JSON shape with a stable machine-readable code, and unexpected failures reveal no internals
- [ ] #5 All API routes are served under `/api`
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Tests: Jest + ts-jest + supertest (Nest's defaults). Tests import describe/it/expect from @jest/globals, so no test globals leak into production types. An HTTP smoke test proves the harness boots AppModule.
2. Configuration: @nestjs/config with a Zod schema validated once at startup. PORT now; each later task adds the variables it uses (database URL in TASK-3, JWT secret in TASK-4). .env.example lists them.
3. Validation and errors: a small Zod validation pipe of our own (nestjs-zod 5.5.0 supports only Nest 10 and 11). Every error answers as RFC 9457 Problem Details with a stable machine-readable code, from one exception filter registered as APP_FILTER. The /api prefix is set in a configureApp function shared by main.ts and the HTTP tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC #1 changed: it listed the database URL and JWT secret, which nothing reads until TASK-3 and TASK-4. Each task now adds the variables it uses, so the API never demands a setting it ignores.
<!-- SECTION:NOTES:END -->
