---
id: TASK-10
title: Web app foundation and login
status: Done
assignee:
  - '@SimonyanSuren'
  - '@claude'
created_date: '2026-11-01T23:42:00Z'
updated_date: '2026-11-04T01:25:00Z'
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
- [x] #1 A React app in `apps/web`, type-checked in strict mode with the shared base config and covered by the root lint, typecheck and build commands
- [x] #2 Users and admins log in with the seeded credentials and land on their role's start page; logging out returns to the login page
- [x] #3 API errors are shown in plain words, never as raw responses or stack traces
- [x] #4 The web app calls the API under `/api` on its own origin, so the browser needs no CORS
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Foundation in place: login page, role-based start pages, errors from Problem Details, Vite proxy for /api. Criterion 2 can be verified end to end once the login API (TASK-4) and the seeded users (TASK-9) exist.

Checked in Chrome against a fresh seeded stack (docker compose, separate project on port 18080), 4 Nov 2026. A wrong password showed 'The email or password is not correct.'; ana landed on Courts and the admin on court management; Log out returned to the login page. Every request went to /api on the page's own origin through nginx, with no console errors. Strict TypeScript and the root lint, typecheck and build pass in CI.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
React 19 app built by Vite in apps/web, strict TypeScript, covered by the root lint, typecheck, build and test commands. Login with the seeded accounts lands each role on its start page; API errors are shown as sentences; the app calls /api on its own origin, so no CORS. Verified in a real browser and by the web tests.
<!-- SECTION:FINAL_SUMMARY:END -->
