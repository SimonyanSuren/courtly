---
id: TASK-4
title: Login with seeded users and role-based access
status: To Do
assignee: []
created_date: '2026-11-01T23:42:00Z'
updated_date: '2026-11-02T14:11:00Z'
labels:
  - api
dependencies:
  - TASK-3
priority: high
type: feature
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
There are two roles, User and Admin, and the API itself must enforce what each may do: hiding buttons in the UI is not access control. Users are seeded, so there is no sign-up.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A seeded user logs in with email and password and receives a signed JWT in an httpOnly cookie; wrong credentials get 401 without saying which part was wrong
- [ ] #2 Passwords are stored only as hashes from a slow, salted password-hashing function
- [ ] #3 Every route requires a valid token unless it is explicitly marked public; a missing, invalid or expired token gets 401
- [ ] #4 Admin-only routes return 403 to users and user-only routes return 403 to admins, tested over HTTP
- [ ] #5 `GET /api/auth/me` returns the current user and role, and logging out clears the cookie
- [ ] #6 Schema changes are versioned SQL migrations generated from the Drizzle schema and applied with one command, from compiled code so the production image needs no dev tools
- [ ] #7 Tests run against a database with every migration applied, and each test starts from known data
<!-- AC:END -->
