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

- **Chosen:** in `apps/api/src`, technical capabilities live in `platform/` (clock, config,
  database, health, http) and business areas in `modules/`, one folder each, created when it has
  content. `app.module.ts` is the only file that wires every module together; the seed beside
  it imports their tables. Lint rejects any import
  from `platform/` into `modules/`.
- **Inside a module:** the Nest CLI layout. The module, controller, service and repository files
  sit at the top, next to `<name>.schema.ts`, the module's Drizzle tables. `dto/` holds the Zod
  schemas that validate requests and, where the JSON differs from the module's values, the
  response types and the functions that build them (`bookings/dto/responses.ts`). `guards/` or
  `decorators/` appear where a module has them. A part of a module with several files of its own
  gets a folder, such as `auth/sessions/` (table, repository, cookie and token). Business rules
  that need neither the database nor HTTP, such as opening hours or the cancellation window, are
  pure functions in a `domain/` folder, tested without Nest; services call them and turn a broken
  rule into an `ApiError`.
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
  - `entities/*.entity.ts`, the Nest CLI's name for table files: it comes from TypeORM's entity
    classes, and in domain-driven design an entity is a domain object with behaviour, which here
    lives in `domain/`. Drizzle calls these declarations the schema, as does drizzle-kit's
    `schema` setting.
  - Layers in every module (`application/`, `domain/`, `infrastructure/`), as in Clean
    Architecture: each module here has a handful of rules and one database, so the layers would
    add indirection with nothing to swap behind them. The `domain/` folder keeps their main
    benefit, rules testable on their own.

## 9. Login: server-side sessions, passwords hashed with argon2id

- **Chosen:** logging in starts a server-side session. The browser gets a random 32-byte token in
  an httpOnly cookie; the database keeps only the token's SHA-256 hash, with its user and expiry.
  A global guard rejects every request without a valid session unless the route is marked
  public. Passwords are hashed with argon2id from `node:crypto`, at OWASP's recommended cost
  (19 MiB of memory, 2 passes, 1 lane). The cookie is `SameSite=Lax`, and Nest's
  `enableCsrfProtection()` rejects state-changing requests from other origins, judged by the
  browser's `Sec-Fetch-Site` header.
- **Why:** with sessions, logging out ends access at once and a role change applies on the next
  request; there is no signing key to protect or rotate. The price is one indexed query per
  request. argon2id is OWASP's first choice for passwords, and Node has it built in (stable since
  Node 26.4), so no native module has to be compiled.
- **Rejected:**
  - A JWT in the cookie: it stays valid until it expires, even after logout, and a safe setup
    needs refresh tokens kept on the server anyway. JWTs pay off when other services must check a
    user without calling this API. A mobile app could later send the same session token in an
    `Authorization` header.
  - Nest's `@nestjs/authentication` and `@nestjs/authorization` packages: official, but 0.1
    releases first published in September 2026. The code here follows the same design (a global
    guard, hashed session tokens, a dummy hash check for unknown emails) in a few small files.
  - Passport (`@nestjs/passport`): a strategy layer that adds indirection for one login method.
  - bcrypt: it uses only the first 72 bytes of a password, and like the `argon2` npm package it
    is a native module that needs install scripts, which `.npmrc` disables.
  - scrypt: OWASP's alternative for when argon2id is not available.
  - CSRF tokens: every current browser sends `Sec-Fetch-Site`, which tells a same-origin request
    from a cross-site one, so a token would add state and a round trip without more protection.

## 10. Docker: one image per app, migrations as a one-off service

- **Chosen:** each app has a multi-stage Dockerfile in its own folder (`apps/api/Dockerfile`),
  built from the repository root, with its allowlist in `Dockerfile.dockerignore` next to it. The
  runtime image is Node 26 on Debian slim with production dependencies only; its files belong to
  root and it runs as UID 1000. Compose starts PostgreSQL, then one-off `migrate` and `seed`
  services, then the API, each waiting for a health check or for the previous step to exit
  successfully. The
  containers run with a read-only filesystem and no Linux capabilities.
- **Why:** npm workspaces share one lockfile at the root, so the root is the build context; the
  Dockerfile-specific ignore file still sends each build only the files it needs. Migrations run
  once, before any API instance starts: two processes applying them at the same time could apply
  one twice. A non-root process over root-owned files cannot rewrite its own code.
- **Rejected:**
  - One Dockerfile at the root: unclear which app it builds once the web app has its own image.
  - Migrating when the API starts: several API instances would race to apply the migrations.
  - Compose profiles: a plain `docker compose up` must start everything.
  - Installing the root workspace in the build: it brings the linters and git hooks, while
    TypeScript already comes with `@nestjs/cli`.
  - An init process such as tini: Node handles SIGTERM itself and starts no child processes.
  - Alpine: Node supports musl only on x64 and at Tier 2, while glibc is Tier 1 on x64 and arm64
    (Apple-silicon Macs).

## 11. Time: Temporal, real hours and the days the clocks change

- **Chosen:** Node's built-in Temporal. The booking rules are pure functions in
  `modules/courts/domain` and `modules/bookings/domain`; they take `Temporal.Instant` for moments
  and `Temporal.PlainDate` for calendar days. `Date` appears only where the `pg` driver returns
  it.
- **A court is open while the facility's clock shows a time from its opening hour up to its
  closing hour.** When the clocks go forward, the skipped hour (01:00 in Lisbon) opens or closes a
  court at the moment the clock jumps past it; when they go back, the repeated hour (01:00) counts
  from its first occurrence.
- **Hours are real hours:** slots, 2-hour bookings and the 2-hour cancellation notice are exact
  durations, also across a clock change.
- **A booking stays within the day it starts on**, as opening hours do: at a court open from 0 to
  24, a 2-hour booking at 23:00 is rejected.
- **Why:** availability and booking derive from the same list of slots, so they always agree,
  and the rules match what a person at the facility sees on the clock.
- **Rejected:**
  - A date library: Temporal is built into Node 26, and TypeScript 6.0 types it (lib
    `esnext.temporal`).
  - `Date` in the rules: it has no type for a calendar day, it is mutable, and `<` compares two
    dates without complaint.
  - For a skipped hour, the time before the jump: a court would open before its opening hour.
  - For a repeated hour, its second occurrence: a court would stay open after the clock showed
    its closing hour.
  - Rejecting such times: availability would fail for the whole day.

## 12. Web app: React with Vite, React Router, TanStack Query and Mantine

- **Chosen:** a React 19 single-page app built by Vite. React Router, in declarative mode, maps
  URLs to screens; TanStack Query holds what the server says, from the logged-in user to
  availability and bookings, with loading and error states; Mantine provides the components.
  Tests use Vitest and Testing Library. The app calls the API under `/api` on its own origin:
  through Vite's proxy in development, through the web server in Docker.
- **Why:** the API is a separate service, so the browser needs only static files. Served from the
  same origin as `/api`, the httpOnly session cookie stays first-party and no CORS is needed.
  Mantine gives accessible, labelled form fields and an app shell without custom CSS. Vitest
  reuses Vite's configuration, so tests compile the code the way the build does.
- **Rejected:**
  - Next.js: its server rendering and route handlers would duplicate the separate API and need a
    Node server where static files are enough.
  - Create React App: deprecated by the React team.
  - Redux: the app's state is server data, which TanStack Query caches and refreshes; Redux would
    hold copies of it by hand.
  - Tailwind alone: every form field, label, error message and layout would be built and made
    accessible by hand.
  - Jest for the web app: it needs its own TypeScript and ESM transform next to Vite's.
  - React Router's data and framework modes: loaders would duplicate TanStack Query, and the
    framework mode adds a build plugin and file conventions.

## 13. API contract: one documented contract, no version prefix

- **Chosen:** `docs/api.md` describes every route, type and error code the web app relies on.
  Paths start with `/api` and carry no version. Changes are additive: a field is renamed or
  removed only once the web app no longer reads it. Versions arrive with the first client that is
  released on its own schedule, such as a mobile app, whose installed copies stay in use for
  months, or an API for partners.
- **Why:** the web app is the only client. It is built from the same commit as the API, deployed
  with it and served from the same origin, so a breaking change ships together with the code that
  adapts to it. The one older client is a browser tab still running the previous bundle during a
  deploy, and additive changes keep it working. Adding versions later changes no URL: with Nest's
  URI versioning (`app.enableVersioning()`), a route without a version keeps its path, and only
  the routes that change get `/api/v2/...`.
- **Rejected:**
  - `/api/v1` from the start: every URL, test, proxy rule and document would carry a version
    that has no alternative.
  - A version in a header or in the media type: the same lack of need, and invisible in URLs and
    logs.
  - A success envelope such as `{ data }` around every response: the status code already says
    whether a request worked, and every client would unwrap every call. Only `GET /api/courts`
    answers a bare array, and a facility's courts need no paging; a list that does would get
    `{ items, nextCursor }`.
  - Response types shared with the web app through a package: a mismatch would fail the build,
    but it needs a new workspace and changes to both images. It is a next step.

## 14. Web image: static files and the API proxy on nginx

- **Chosen:** `apps/web/Dockerfile` builds the app with Vite on the API's Node image and serves
  `dist/` from nginx's unprivileged image (stable, Alpine slim). It runs as UID 101 on port 8080
  with a read-only filesystem and one tmpfs for `/tmp`. nginx passes `/api/` to the API with the
  browser's Host header unchanged (`$http_host`), answers every other path with `index.html`,
  caches the hashed files in `/assets/` for a year as immutable, and has browsers revalidate
  `index.html` on every load. Every response carries `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: same-origin` and a Content Security Policy that allows only this origin,
  inline styles (Mantine adds `<style>` elements at run time) and no framing.
- **Why:** one origin for the app and the API keeps the session cookie first-party and needs no
  CORS. Nest's cross-origin check compares Origin with Host when Sec-Fetch-Site is missing; with
  nginx's default Host (`api:3000`) or `$host` (no port), same-origin requests would be rejected.
  nginx looks up the API's address only at start, so Compose restarts it whenever it replaces the
  API container; otherwise the proxy answers 502 while its own health check passes.
- **Rejected:**
  - Caddy: its official image runs as root and writes state to `/config` and `/data`.
  - `vite preview`, or the API serving the files: either puts Node in the web image.
  - `Referrer-Policy: no-referrer`: browsers then send `Origin: null` on form posts, which the
    cross-origin check rejects.
  - Nonces or hashes instead of inline styles: static files cannot carry a nonce that changes
    with every response, and hashes break with every theme change.
  - nginx's `resolver` pointed at Docker's DNS: more configuration, tied to Docker's address.

## 15. Web app data: facility time, refresh after a change, and the session

- **Chosen:**
  - Dates and times show on the facility's clock (Europe/Lisbon), whatever the device's time zone,
    in one locale (`en-GB`: day before month, 24-hour clock), formatted with the browser's `Intl`.
    The web tests run as a device in New York (`TZ=America/New_York`), so a time shown in the
    device's zone fails them on every machine.
  - After a booking or a cancellation, accepted or refused, the app refetches the day's slots and
    the user's bookings: a refusal means the server knows something newer, such as a slot just
    taken. The date is a native date input.
  - A 401 to any request while logged in means the session expired or ended elsewhere: the app
    logs out and shows the login page. Logging out, by either path, removes every cached answer.
  - Requests are retried only when no answer arrived or the server failed; a 4xx would come back
    the same.
- **Why:** a court opens at 08:00 Lisbon time for everyone, so a visitor abroad must not see it
  shifted. The server decides whether a slot is free, so the screens show what it last said and
  ask again after every change. A browser can be shared, so the next person on it must not see
  the previous user's bookings.
- **Rejected:**
  - Optimistic updates: the slot would show as booked before the server agreed, and vanish when
    it refuses.
  - A date library or Mantine's date picker (`@mantine/dates` and `dayjs`): the screens only
    format moments the API sends and pick a day, which `Intl` and the native input do without a
    dependency.

## 16. Roles: every route names the roles that may use it

- **Chosen:** `@Roles(['admin'])`, made with Nest's `Reflector.createDecorator`, on a route or a
  controller; a route's own list replaces its controller's. A second global guard, after the
  session guard, answers 403 when the user's role is not in the list. A route with neither
  `@Public()` nor `@Roles()` answers 500 to everyone, and the error, naming the route, is logged.
  The role comes from the `users` row on every request, with the session, so a role change
  applies at once.
- **Why:** admins do not book, so being logged in is not enough for most routes. Like the session
  guard, the roles guard denies by default: a route nobody decided access for stays closed, and
  the first test that calls it shows the mistake. The contract's "any" routes, such as
  `GET /api/auth/me`, name both roles.
- **Rejected:**
  - Letting a route without `@Roles()` through, as Nest's documentation example does: a
    forgotten list on an admin route would open it to every user.
  - A 403 for a route without `@Roles()`: the client would see a permission problem for what is
    a server bug, and nothing would be logged.
  - Permissions or policies, such as CASL from Nest's authorization docs: two fixed roles need no
    rule engine.
  - One guard for both checks: two guards keep each check small; a test pins their order (no
    session gives 401, not 403).

## 17. Login rate limit: per client address and per email

- **Chosen:** Nest's `@nestjs/throttler`, on the login route only. Every attempt, successful or
  not, counts against two limits over 15 minutes: 50 from one client address and 10 for one
  email, trimmed and lower-cased as login compares it. One attempt too many gets 429
  `TOO_MANY_LOGIN_ATTEMPTS` with the minutes to wait and `Retry-After` in seconds, for 15
  minutes. No other rate-limit headers are sent. Behind nginx, which replaces `X-Forwarded-For`
  with the address the client connected from, the API trusts exactly one proxy
  (`TRUST_PROXY_HOPS=1`); by default it trusts none. The counters are kept in memory.
- **Why:** the address limit stops one client trying many accounts; the email limit stops many
  addresses guessing one account's password, which an address limit alone allows. argon2id
  already makes each guess slow; the limits cap how many there are. Without the trusted proxy,
  every client would share nginx's address, and one person's typos would lock everyone out.
  Trusting the header with no proxy in front would let any client choose its own address. The
  price: someone who knows a user's email can block that user's logins for 15 minutes, and the
  counters reset on a restart and are per instance.
- **Rejected:**
  - Counting only failed attempts: it needs bookkeeping after the password check, outside the
    throttler, and someone logging in normally does not reach 10 in 15 minutes.
  - Locking the account until an admin unlocks it: every guessing attempt becomes a support
    request, and an attacker can lock out anyone.
  - Shared storage such as Redis for the counters: one more service for one API instance. The
    throttler accepts one when the API runs as several.

## 18. Admin screens: prices typed in euros, errors at their fields

- **Chosen:**
  - Admins type a price in euros, with up to 2 decimals after a dot or a comma. The digits
    become integer cents without floating-point arithmetic. Anything else is refused at the
    field before sending; whether the amount is allowed is the server's decision.
  - Each message from the server shows once: a 400's `errors[]` at the field with that path, a
    409 `COURT_NAME_TAKEN` at the name, anything else in an alert above the form.
  - The API words every field message for the person at the form, with amounts in euros ("Must
    be at most €1,000.00 an hour."), and the tests check each sentence. Zod's defaults are written
    for developers and in the unit sent: "expected number to be <=100000" next to a price in euros
    reads as €100,000.
  - The API words every field message for the person at the form, with amounts in euros ("Must
    be at most €1,000.00 an hour."), and the tests check each sentence. Zod's defaults are written
    for developers and in the unit sent: "expected number to be <=100000" next to a price in euros
    reads as €100,000.
  - After any change to a court, accepted or refused, the courts list is fetched again.
  - Courts are created and edited in a dialog over the list; deactivating and reactivating take
    one click, without a confirmation.
  - The day view keeps its date in the address and shows the API's `expectedRevenueCents`.
- **Why:** as floating-point numbers, 19.99 × 100 is 1998.9999999999998. A comma is what a
  Portuguese keyboard types, and with at most 2 decimals it cannot be read as a thousands
  separator. A price changed silently is worse than a question. Deactivating is undone with one
  more click and keeps every booking. Summing revenue in the browser would put the rule in two
  places.
- **Rejected:**
  - `parseFloat` and multiplying by 100, then rounding: correct only with care, where reading
    the digits is exact by construction.
  - Mantine's `NumberInput`: its value is a floating-point number.
  - Checking the price range in the browser as well: the limit would live in two places, and the
    server's answer reaches the field just as fast.
  - Sentences written by the web app from codes the API sends: the usual choice with several
    clients or languages, but with one client in one language it is a second table of the same
    rules.
  - Checking the price range in the browser as well: the limit would live in two places, and the
    server's answer reaches the field just as fast.
  - Rounding a third decimal.
  - Separate pages for creating and editing: more routes, while the list already holds the court.

## 19. Courts: names unique ignoring case, money in integer cents, limits in the database too

- **Chosen:** court names are trimmed and unique ignoring case: a unique index on `lower(name)`,
  with CHECK constraints keeping stored names trimmed and 1 to 100 characters. Prices are
  integer cents from 1 to 100,000 (€1,000.00 an hour). The database checks every limit the
  request validation checks. A duplicate name is the unique index's violation, answered with
  409 `COURT_NAME_TAKEN`. Opening hours that another change made invalid in the meantime are the
  CHECK's violation, answered with the validation's 400. An id that is not a UUID answers 404,
  as an unknown one does. Money is integer cents everywhere: in the columns, in JSON and in the
  code.
- **Why:** users pick courts by name and cannot tell "Padel 1" from "padel 1". Only the index sees
  a name another request is inserting at the same moment, so two creates cannot both take it.
  €1,000 an hour is far above any court's price, so a price typed with extra zeros is refused,
  and a 2-hour booking stays far below the integer column's limit. A path segment that is not a
  UUID names no court; clients treat ids as opaque. Money moves in whole cents: charges, refunds
  and the amounts payment providers take (Stripe and Adyen use integer minor units), so integers
  are exact and need no conversion. Payments would add a currency next to each amount, a money
  type, one explicit rounding rule where fractions appear (VAT, discounts, splitting a price) and
  `bigint` for totals.
- **Rejected:**
  - A lookup before the insert: two requests can both find the name free.
  - `citext` or a case-insensitive collation: an extension or a declared collation for what
    `lower()` does, as for emails.
  - 400 for a malformed id: clients would come to depend on the id's format.
  - decimal.js or PostgreSQL `numeric` for amounts: the driver returns `numeric` as a string, and
    every boundary would convert, for an exactness integers already have. Decimals suit rates and
    unit prices below a cent, not amounts.

## 20. Fixed value sets as enum-like objects; each module's errors in one file

- **Chosen:** a fixed set of values is a const object with UPPER_CASE members and a type of the
  same name, in the module's `domain/`: `Role.ADMIN`, `Sport.PADEL`. The database enum
  (`pgEnum`), the request validation (`z.enum`) and the code read the same object. Each module's
  errors are functions in `<module>.errors.ts`, such as `CourtError.notFound()`, each with its
  status, code and sentence.
- **Why:** one list feeds the database, the validation and the code, so they cannot drift apart;
  a name says what a comparison means, and the editor finds every use. Members are UPPER_CASE,
  as the lint configuration asks of TypeScript enum members and as in Nest's
  `HttpStatus.NOT_FOUND`. Error functions keep a code with its wording, and each throw gets its
  own stack trace. `@typescript-eslint/no-redeclare` is off: TypeScript reports a real
  redeclaration itself, and the rule refused a value and a type sharing a name.
- **Rejected:**
  - TypeScript `enum`: extra generated JavaScript, and not erasable syntax, which Node's type
    stripping refuses.
  - String literals alone (`'admin'`): type-checked, but a search for every admin check also
    finds `/admin` and `admin@example.com`.
  - One global file of error codes: the codes are each module's vocabulary, and every module
    would edit the same file.
  - Shared error instances: one object would carry the stack trace of wherever it was created.

## 21. Continuous integration: GitHub Actions on every push and pull request

- **Chosen:** `.github/workflows/ci.yaml` runs on every push and pull request, as two parallel
  jobs on `ubuntu-26.04`. `checks` installs with `npm ci` on the Node version in `.nvmrc`, with
  npm's download cache, then runs format:check, lint, typecheck, knip, the build and the tests;
  the API tests start PostgreSQL with Testcontainers on the runner's Docker. `stack` runs
  `docker compose up --wait`, exactly as the project is run, and checks `/api/health` through
  nginx; on failure it prints the services' logs. The workflow's token can only read the
  repository, and checkout does not keep it. Each action is pinned to a commit SHA, its version in
  a comment. A newer push to the same branch or pull request cancels the older run, and a job
  stops after 15 minutes.
- **Why:** git hooks can be skipped, and CI shows a broken commit to anyone reading the
  repository. The images build from their allowlists and install each app's dependencies alone,
  so a file or package missing from an image fails in CI, and so does a stack that does not
  start, rather than at the next `docker compose up`. A tag can be moved to other code; a commit
  SHA cannot. A fixed runner release changes in a commit, not when GitHub moves `ubuntu-latest`.
- **Rejected:**
  - commitlint in CI: the commit-msg hook checks each message when it is written. On `main`,
    which receives pushes directly, CI could only report a message already published. With pull
    requests, `commitlint --from <base> --to <head>` would block the merge.
  - A PostgreSQL service container: the tests start their own, as they do locally.
  - Docker layer caching through `docker/build-push-action`: two more actions to pin, for a job
    that runs alongside the longer `checks`.
  - One job per check: each would repeat the checkout and `npm ci`.

## 22. Bookings: overlaps refused by the database, the time now injected

- **Chosen:** an exclusion constraint, `bookings_no_overlap`, with the `btree_gist` extension:
  `EXCLUDE USING gist (court_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)`
  `WHERE (status = 'confirmed')`. Its violation, SQLSTATE 23P01 matched by the constraint's
  name, answers 409 `SLOT_TAKEN`; nothing looks for a free slot first. It lives in a hand-written
  migration (`drizzle-kit generate --custom`): Drizzle cannot declare it, and its snapshots never
  contain it, so later generated migrations never drop it. Cancelling is an update on the
  condition that the booking is still confirmed. Every rule a row can be checked against on its
  own is a CHECK: 1 or 2 hours, the end exactly that many real hours after the start, a positive
  price, and a cancellation time exactly when cancelled. Courts and users with bookings cannot be
  deleted. A booking stores its price. The time now comes from an injectable `Clock` that tests
  replace. Availability lives in the bookings module and reads courts through `CourtsService`.
  Expected revenue is summed from the day view's own rows. The service works with Temporal
  values; `dto/responses.ts` writes them as the JSON in `docs/api.md`, and the controllers call
  it.
- **Why:** under READ COMMITTED a lookup cannot see a booking another request has inserted but not
  committed, so both requests would find the slot free. The constraint sees the uncommitted row:
  the second insert waits for the first to commit, then fails. Opening hours and prices change, so
  they are checked when booking, not by the table. Summing the listed rows keeps the total equal
  to what is shown, and avoids `sum()`, which returns a bigint (a string from the driver) and NULL
  on an empty day. Without the JSON shape, the service holds only the rules, and one file decides
  how a moment is written.
- **Rejected:**
  - Check, then insert: the check misses uncommitted rows.
  - Locking the court's row first: it serialises bookings in application code, and a write path
    that skips the lock can still double book.
  - SERIALIZABLE transactions: the losing request gets a serialization failure to retry, not a
    violation that names the rule.
  - One row per booked hour under a unique key: time modelled as slots, and a 2-hour booking as
    two rows.
  - Jest's fake timers for the time now: they replace timers and `Date` for the whole process,
    the database driver's and the HTTP client's included.
  - Formatting times in the service: it mixed the rules with the JSON shape.

## 23. Demo data: seeded once into a fresh database, placed around today

- **Chosen:** `src/seed.ts`, compiled with the API like `migrate.ts`, runs as a one-off Compose
  service after the migrations and before the API; outside Docker it is `npm run db:seed`. It
  inserts 3 accounts (password `courtly-demo`), 5 courts of 4 sports, one of them inactive, and 13
  bookings on Lisbon calendar days from a week ago to 2 days ahead, some cancelled. It writes the
  tables directly, in one transaction, and changes nothing when the database has any user. Each
  booking passes `checkBooking` at the moment it was supposedly made: 3 days before it starts, or
  3 days before now if it starts later.
- **Why:** the demo must have upcoming bookings whenever it is started, so its dates follow the
  current date. A database with users holds earlier or real data that a seed must not touch;
  `docker compose down -v` gives a fresh one. One transaction means a failed seed leaves nothing
  behind, and the unique email makes a second run started at the same moment fail instead of
  duplicating. The service rightly refuses bookings in the past, so the seed writes the tables,
  checked by the rule function the service uses.
- **Rejected:**
  - A data migration: migrations run in every environment, and their dates cannot follow today.
  - Seeding when the API starts: several instances would race, and the API would carry demo
    code.
  - Upserting row by row (`on conflict do nothing`): bookings have no natural key, and a rerun
    would bring back rows someone had deleted.
  - A table recording that the seed ran: an existing user already tells.
  - Fixed dates: the upcoming bookings would be in the past within days.
