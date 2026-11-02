# Decisions

What was chosen, what was rejected, and why. Newest last. Entries stay short on purpose: the code,
the tests and the commit messages carry the detail.

## 1. One repository with npm workspaces

- **Chosen:** one repository with npm workspaces: `apps/api` now, `apps/web` later.
- **Why:** the whole stack must start from one repository with one `docker compose up`. One
  lockfile and one set of quality gates cover both apps, and a change that touches the API and the
  UI lands in one commit.
- **Rejected:** separate repositories: the stack must start from a single clone. Nx, Turborepo or
  pnpm: build orchestration and caching pay off with many packages, not two.

## 2. NestJS 12 for the API

- **Chosen:** NestJS 12 on its default Express adapter.
- **Why:** the API's main risks are access control and time-based booking rules, and Nest gives
  each a standard, testable place:
  - Access control: a global guard requires authentication on every route unless the route is
    explicitly marked public, so a missing annotation denies access instead of exposing the
    endpoint. Role checks use the same mechanism.
  - Time-based rules: dependency injection lets tests replace the clock, so the cancellation
    window and the no-past-bookings rule are tested at their exact boundaries.
  - Consistency: shared validation and one exception filter give every endpoint the same input
    checks and error format.

  The cost is more concepts and boilerplate than plain Express: modules, providers, decorators.
  That is acceptable for an API whose value lies in enforcing rules consistently.

- **Rejected:**
  - Plain Express: lighter, but authentication, validation and error handling would be wired
    route by route, where one omission becomes a security gap.
  - The Fastify adapter: faster, but throughput is not a constraint here, and Express is Nest's
    default with the larger middleware ecosystem.
  - The new Node adapter (`@nestjs/platform-node`, recommended since Nest 12.3 and the default
    from v13): it speeds up light routes, which this API doesn't need, and it was released on
    27 October 2026. Controllers and guards avoid Express types, so switching later takes a few
    lines.

## 3. Node.js 26 and TypeScript 6.0

- **Chosen:** Node 26, the Active LTS since 28 October 2026. TypeScript 6.0 in strict mode, plus
  `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.
- **Why:** Node 24 moved to maintenance on 20 October 2026. Nest CLI 12 depends on TypeScript
  `~6.0`.
- **Rejected:** TypeScript 7 (the native compiler): released, but not supported by Nest CLI 12.

## 4. Strict quality gates from the first commit

- **Chosen:** type-aware ESLint (typescript-eslint strict, import-x with cycle and dependency
  checks, unicorn, sonarjs, security, n) with Prettier, failing on any warning; knip for unused
  files, exports and dependencies; commitlint, husky and lint-staged; exact version pins, no
  install scripts and an enforced Node version.
- **Why:** a problem is caught in the commit that introduces it, when it is cheapest to fix. The
  cost is a stricter setup to follow from day one. The ESLint config is split into rules shared by
  every workspace and Node rules for the API, so the web app adds its own block instead of
  overriding the API's.
- **Rejected:** lint rules for module boundaries: Courtly's structure is decided when its first
  business module arrives. A folder of one-file decision records: one DECISIONS.md is easier to
  review.

## 5. Tasks in Backlog.md

- **Chosen:** Backlog.md: each task is a Markdown file in `backlog/`, in the repository.
- **Why:** the plan sits next to the code it produced. Acceptance criteria restate the
  requirements, and tasks still open at the end become the README's next steps.
- **Rejected:** GitHub Issues, Jira or Linear: they live outside the repository, and Jira or
  Linear boards are not visible to anyone reading it.

## 6. Booking rules the requirements leave open

Each rule is the simplest one consistent with the stated requirements. The API enforces them and
the tests cover them.

- **Deactivating a court** stops new bookings and keeps the existing ones, past and future.
  Cancelling future bookings automatically would need a way to tell customers, which the app does
  not have.
- **Changing a court's opening hours** leaves existing bookings as they are. Hours are checked when
  a booking is made.
- **Opening hours are whole hours** between 00:00 and 24:00, opening before closing. Slots then
  always line up with the 1-hour grid, and a court's day never crosses midnight.
- **One facility, in Europe/Lisbon.** Availability and the admin day view use calendar days in
  that time zone, so a day lasts 23 or 25 hours when the clocks change.
- **"Up to 2 hours before" includes the boundary:** a booking that starts at 18:00 can be
  cancelled until exactly 16:00.
- **Expected revenue** is the sum of a day's confirmed bookings, each at the price it was booked
  at. Cancelled bookings are listed but not counted, and a later price change does not rewrite
  what a booking was worth.
- **Admins manage courts and see all bookings; they do not book or cancel.** Booking and
  cancelling are user actions, and cancelling on a customer's behalf would need a way to notify
  them.

## 7. PostgreSQL 18 with Drizzle

- **Chosen:** PostgreSQL 18 through Drizzle ORM 0.45 and the `pg` driver. Backend tests run
  against a real PostgreSQL 18 that Testcontainers starts for each test run.
- **Why:** the rule that matters most, no double booking, can live in the database itself. An
  exclusion constraint rejects two bookings of one court whose time ranges overlap, even when both
  requests commit at the same instant, and PostgreSQL supports it directly (with the `btree_gist`
  extension). Drizzle keeps the SQL visible: the schema is TypeScript, queries read like SQL,
  migrations are plain SQL files to review, and raw SQL covers what Drizzle has no syntax for,
  such as that constraint. Only the real engine can prove a constraint in a test; a mock cannot.
- **Rejected:**
  - MySQL: no exclusion constraints, so every booked hour would need its own row under a unique
    key, modelling time as slots instead of ranges.
  - MongoDB: no constraint across documents, so preventing overlaps would rely on locking in
    application code.
  - Prisma: its schema language cannot express an exclusion constraint, and it adds a code
    generation step. TypeORM: decorated entity classes clash with the strict compiler settings
    (every column needs `!`), and its query builder hides more of the SQL.
  - Drizzle 1.0: a release candidate since April 2026 (rc.5 in October). Compared with 0.45,
    only relations and relational queries change, and Courtly does not rely on them.
  - `@nestjs/drizzle`, Nest's own Drizzle module: version 0.0.2, six weeks old. The module here is
    about 30 lines and already creates the pool with its timeouts and its error listener.
  - A shared test database in Docker Compose: tests would depend on its leftover state and on
    someone starting it first.

## 8. Code structure: `src/platform/` and `src/modules/`

- **Chosen:** in `apps/api/src`, technical capabilities live in `platform/` (config, database,
  health, http) and business areas in `modules/`, one folder each, created when it has content.
  `app.module.ts` is the only file that imports every module. Lint rejects any import from
  `platform/` into `modules/`. How a module is organised inside is decided with the first one.
- **Why:** Nest recommends one feature module per area. Keeping them apart from the technical code
  shows what the product does at a glance, and technical code can then never come to depend on
  business code.
- **Rejected:**
  - Features directly in `src/` next to the technical folders, the Nest CLI default: the two
    kinds of folder mix as modules arrive.
  - `common/`, the name in Nest's sample app: there it holds request helpers (filters, guards,
    pipes); here the folder also holds the database and the configuration.
  - Splitting technical code into `platform/` (infrastructure) and `app/` (framework parts): every
    piece here is both, and `app/` would be ambiguous next to `app.module.ts`.
  - Folders by technical type (`controllers/`, `services/`): one feature would touch every folder.
