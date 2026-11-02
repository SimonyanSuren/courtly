---
id: TASK-10
title: Web app foundation and login
status: To Do
assignee: []
created_date: '2026-11-01T23:42:00Z'
labels:
  - web
dependencies:
  - TASK-4
priority: high
type: feature
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Both roles use the product through a browser, and it must be usable without reading the code. This task sets up the web app every screen builds on.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A React app in `apps/web`, type-checked in strict mode with the shared base config and covered by the root lint, typecheck and build commands
- [ ] #2 Users and admins log in with the seeded credentials and land on their role's start page; logging out returns to the login page
- [ ] #3 API errors are shown in plain words, never as raw responses or stack traces
- [ ] #4 The web app calls the API under `/api` on its own origin, so the browser needs no CORS
<!-- AC:END -->
