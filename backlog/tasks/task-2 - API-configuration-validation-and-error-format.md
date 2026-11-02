---
id: TASK-2
title: API configuration, validation and error format
status: To Do
assignee: []
created_date: '2026-11-01T23:42:00Z'
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
- [ ] #1 Settings (port, database URL, JWT secret) come from environment variables, validated once at startup; a missing or invalid one stops the start with an error that names it
- [ ] #2 `.env.example` lists every variable the API reads
- [ ] #3 Request bodies, route parameters and query strings are validated against schemas; invalid input gets 400 with the failing fields
- [ ] #4 Every error response, including validation errors, unknown routes and unexpected failures, has the same JSON shape with a stable machine-readable code, and unexpected failures reveal no internals
- [ ] #5 All API routes are served under `/api`
<!-- AC:END -->
