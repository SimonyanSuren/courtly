---
id: TASK-14
title: Continuous integration
status: In Progress
assignee:
  - '@SimonyanSuren'
  - '@claude'
created_date: '2026-11-01T23:42:00Z'
updated_date: '2026-11-03T15:17:00Z'
labels:
  - infra
dependencies:
  - TASK-3
priority: low
type: chore
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Local Git hooks can be skipped. CI runs the same checks on every push, so a broken commit is visible to anyone looking at the repository.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On every push and pull request, CI runs lint, typecheck, build and the backend tests against PostgreSQL
- [ ] #2 Any failing check fails the run
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
First run on GitHub (41661768477, commit 21bd3b9) passed: checks in 2 min 50 s, including the API tests against Testcontainers PostgreSQL on the runner; stack in 57 s, docker compose up --wait and /api/health through nginx. Criterion 2 rests on the runner's default shell (bash -e), which fails a step and the run on any non-zero exit; no failing run has shown it yet.
<!-- SECTION:NOTES:END -->
