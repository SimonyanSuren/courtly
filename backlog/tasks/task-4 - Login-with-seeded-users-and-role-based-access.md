---
id: TASK-4
title: Login with seeded users and role-based access
status: In Progress
assignee:
  - '@SimonyanSuren'
  - '@claude'
created_date: '2026-11-01T23:42:00Z'
updated_date: '2026-11-02T23:57:00Z'
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
- [ ] #1 A seeded user logs in with email and password and gets a server-side session: a random token in an httpOnly cookie, stored only as a hash; wrong credentials get 401 without saying which part was wrong
- [ ] #2 Passwords are stored only as hashes from a slow, salted password-hashing function
- [ ] #3 Every route requires a valid session unless it is explicitly marked public; a missing, unknown or expired session gets 401
- [ ] #4 Admin-only routes return 403 to users and user-only routes return 403 to admins, tested over HTTP
- [ ] #5 `GET /api/auth/me` returns the current user and role, and logging out ends the session and clears the cookie
- [ ] #6 Schema changes are versioned SQL migrations generated from the Drizzle schema and applied with one command, from compiled code so the production image needs no dev tools
- [ ] #7 Tests run against a database with every migration applied, and each test starts from known data
- [ ] #8 State-changing requests from another origin get 403, so another site cannot act with a user's cookie
- [ ] #9 Repeated login attempts from one client are limited and answered with 429
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Migrations: drizzle-kit generates SQL from the modules' schema files into apps/api/migrations; npm run db:migrate applies them from compiled code with Drizzle's migrator. First table: users (uuidv7 id, unique lower-case email, name, role, password hash, created_at).

2. Tests: global setup migrates a template database and clones one database per Jest worker; a helper empties the tables before each test.

3. Password hasher: argon2id from node:crypto with OWASP's parameters, a hash string that names its parameters, and a dummy hash for unknown emails.

4. Sessions: sessions table (SHA-256 of a 32-byte random token, user, expiry); login, logout and me; a global guard that denies by default, with @Public() in platform/http; cookie HttpOnly, SameSite=Lax, Secure over HTTPS; Nest's enableCsrfProtection().

5. Roles: @Roles() and a roles guard; 401 and 403 tested over HTTP with test-only routes.

6. Login rate limit with @nestjs/throttler.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Criteria 1, 3 and 5 changed from a JWT to a server-side session, and 8 and 9 were added: with sessions, logout and role changes take effect at once and there is no signing key to protect. See DECISIONS.md.
<!-- SECTION:NOTES:END -->
