---
id: TASK-14
title: Continuous integration
status: In Progress
assignee:
  - '@SimonyanSuren'
  - '@claude'
created_date: '2026-11-01T23:42:00Z'
updated_date: '2026-11-03T14:18:00Z'
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
- [ ] #1 On every push and pull request, CI runs lint, typecheck, build and the backend tests against PostgreSQL
- [ ] #2 Any failing check fails the run
<!-- AC:END -->
