# Courtly

Book sports courts at a facility. Users browse the courts, see a day's free hours, and book or
cancel; admins manage the courts and see every booking of a day with the revenue it should bring.

## Run it

You need Docker with Compose, and ports 8080, 3000 and 5432 free on 127.0.0.1.

```sh
git clone https://github.com/SimonyanSuren/courtly.git
cd courtly
docker compose up
```

This starts PostgreSQL, applies the migrations, seeds the demo data, then starts the API and the
web app. The first start builds the two images.

| What                      | Where                                                    |
| ------------------------- | -------------------------------------------------------- |
| The web app               | http://localhost:8080                                    |
| The API reference, to try | http://localhost:8080/api/docs (Swagger UI)              |
| The API                   | http://localhost:8080/api, and http://127.0.0.1:3000/api |
| Health check              | http://localhost:8080/api/health                         |

Every demo account has the password `courtly-demo`:

| Email             | Role  | Name        |
| ----------------- | ----- | ----------- |
| admin@example.com | admin | Marta Costa |
| ana@example.com   | user  | Ana Silva   |
| rui@example.com   | user  | Rui Santos  |

The demo data has five courts, one of them inactive, and bookings placed around the day you
start it: past ones, some today and some in the coming days, a cancelled one among them. It is
seeded once, into an empty database. `docker compose down -v` deletes the data, and the next
`docker compose up` seeds it again.

## What it does

- **Users** see the active courts, and a court's slots on a day, one per hour from opening to
  closing, each available, taken or already started. They book 1 or 2 consecutive hours, never in
  the past, and cancel up to 2 hours before the start (at 16:00 for an 18:00 booking, but not
  after). Their bookings are listed as upcoming and past, cancelled ones included.
- **Admins** create and edit courts, and deactivate or reactivate them: a deactivated court takes
  no new bookings and keeps its history. The day view lists every booking that starts on a day,
  at any court, with the expected revenue: the confirmed bookings, each at the price it was
  booked at.
- **Roles are enforced by the API.** Every route needs a session unless it is marked public, and
  names the roles that may use it; the web app only hides what a role cannot use.
- **Times are the facility's**, in Europe/Lisbon, whatever the visitor's time zone. A day lasts 23
  or 25 hours when the clocks change.

[DECISIONS.md](DECISIONS.md), entry 6, lists the rules the requirements leave open and the choice
made for each. [docs/api.md](docs/api.md) describes every route, its body and its errors.

## Stack, and why

**React with Vite, not Next.js.** The API is a separate service, so the browser needs only static
files: Vite builds them, and nginx serves them next to a proxy for `/api`, so the session cookie
stays first-party and no CORS is needed. Next.js would add server rendering and route handlers
that duplicate the API, and a Node server to run where static files are enough; a booking tool
behind a login gains little from server rendering. TanStack Query holds what the server says,
and Mantine gives accessible form fields without custom CSS.

**NestJS, not plain Express.** Nest runs on Express and adds a standard place for each rule that
must hold on every route: a global guard denies any route not marked public, one pipe validates
every input against its Zod schema, and one filter writes every error in the same format.
Dependency injection lets the tests replace the clock, so the cancellation window and the
no-past-bookings rule are tested at their exact boundaries. The cost is more concepts than
Express; there, each of these would be wired route by route, and one omission is a security gap.

**PostgreSQL, with Drizzle.** The rule that matters most, no double booking, can be a constraint
in PostgreSQL: an exclusion constraint on time ranges. MySQL has none, so each booked hour would
need its own row under a unique key; MongoDB has no constraint across documents, so overlaps would
be prevented by locking in code. Drizzle keeps the SQL visible: the schema is TypeScript, the
migrations are SQL files to review, and raw SQL covers the constraint, which Prisma's schema
language cannot express.

The other choices, such as server-side sessions instead of JWTs, Temporal for times and Swagger
generated from the Zod schemas, are in [DECISIONS.md](DECISIONS.md), each with what was rejected.

## How double booking is prevented

The database refuses it, with an exclusion constraint on the bookings table, added by
[its migration](apps/api/migrations/0004_bookings_no_overlap.sql):

```sql
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap" EXCLUDE USING gist (
	"court_id" WITH =,
	tstzrange("starts_at", "ends_at", '[)') WITH &&
) WHERE ("status" = 'confirmed');
```

- Two confirmed bookings of the same court can never hold overlapping times. The ranges exclude
  their end, so a booking may start when the previous one ends. A 2-hour booking is one row with a
  2-hour range, so it conflicts with a booking of either hour.
- Only confirmed bookings count: cancelling a booking frees its time at once, and the cancelled row
  stays as history.
- When two requests book the same hour at the same instant, PostgreSQL makes the second insert
  wait until the first transaction ends. If the first commits, the second fails with SQLSTATE
  23P01, which the API answers with 409 `SLOT_TAKEN` (`rejectingTakenSlot()` in
  `apps/api/src/modules/bookings/bookings.service.ts`). If the first rolls back, the second
  succeeds.
- Nothing looks for a free slot before inserting. Under READ COMMITTED, such a lookup cannot see a
  booking another request has inserted but not yet committed, so both requests would find the
  slot free. The availability screen is only a guide; the constraint decides.
- Two cancels at once are handled the same way: the update applies only while the booking is
  still confirmed, so the second finds nothing to change and answers 409
  `BOOKING_ALREADY_CANCELLED`.

The tests force the race instead of hoping for it (`apps/api/test/bookings.spec.ts`, "two
requests at the same moment"). Another connection inserts a booking in a transaction it keeps
open; the test sends the API's request, waits until PostgreSQL makes the API's insert wait for
that transaction, then commits or rolls it back and checks the answer.

Rules that a row can be checked against on its own are CHECK constraints too: 1 or 2 hours, the
end exactly that many hours after the start, a positive price, and a cancellation time exactly
when the booking is cancelled. Rules that depend on data that changes, such as opening hours, the
time now and the cancellation window, are pure functions in `bookings/domain/`, which the service
calls before writing.

## Tests

```sh
npm ci
npm test    # needs Docker: the API tests start their own PostgreSQL with Testcontainers
```

- **API, 327 tests (Jest).** HTTP tests in `apps/api/test/` boot the whole app against a real
  PostgreSQL 18; unit tests sit next to the code. The booking rules are covered at their
  boundaries: double booking, including the forced races above (`test/bookings.spec.ts`); the
  cancellation window, at exactly 2 hours before the start and just after
  (`bookings/domain/cancellation.spec.ts`, `test/bookings.spec.ts`); opening hours, including a
  court open until midnight and the days the clocks change (`courts/domain/opening-hours.spec.ts`,
  `bookings/domain/booking.spec.ts`, `test/availability.spec.ts`).
- **Web, 60 tests (Vitest and Testing Library).** They render the app's routes with the API's
  answers stubbed, and click through logging in, booking, cancelling and managing courts.
- **The API reference** is tested too: every route the app answers is documented, and a route
  is marked as needing a session exactly when it answers 401 without one.

GitHub Actions runs the formatting, lint, type and unused-code checks, the build and every test on
each push, then starts the project with `docker compose up` and calls the health check.

## Performance

Availability and the admin day view were measured with 10,000, 100,000 and 1,000,000 bookings
(`npm run perf -w apps/api`). At a million bookings, availability takes about 1 ms and the day
view about 4 ms, the same as at 10,000. Availability took 51.7 ms at a million before its query
was written in the terms of the no-overlap constraint, whose index then finds the day's bookings
directly. The method, the plans and every number are in [docs/performance.md](docs/performance.md).

## Develop

You need Node.js 26.13 (`.nvmrc`; npm refuses other versions) and Docker.

```sh
nvm use
npm ci
npm run prepare                          # the Git hooks (.npmrc turns off install scripts)
cp apps/api/.env.example apps/api/.env
docker compose up -d --wait postgres     # PostgreSQL 18 on 127.0.0.1:5432
npm run build -w apps/api
npm run db:migrate -w apps/api
npm run db:seed -w apps/api              # the demo data, into an empty database
npm run start:dev -w apps/api            # the API on http://localhost:3000, reloading
npm run dev -w apps/web                  # the web app on http://localhost:5173, proxying /api
```

Checks, from the repository root, each covering every workspace: `npm run lint`,
`npm run typecheck`, `npm test`, `npm run build`, `npm run knip` (unused files, exports and
dependencies) and `npm run format:check`. Git hooks lint and format the staged files before each
commit, check the commit message (Conventional Commits) and type-check before each push.

## Layout

- `apps/api/`: the NestJS API. `src/platform/` holds technical capabilities (configuration,
  database, HTTP, API reference, health); `src/modules/` holds the business areas (auth, users,
  courts, bookings), and platform code never imports them. Inside a module, requests go from the
  controller to the service to the repository; business rules that need neither HTTP nor the
  database are pure functions in `domain/`.
- `apps/web/`: the React app, one folder per area (auth, courts, bookings, admin).
- [DECISIONS.md](DECISIONS.md): what was chosen, what was rejected, and why.
- [docs/](docs/): the API contract and the performance measurements.
- [backlog/](backlog/): the tasks, tracked with [Backlog.md](https://github.com/MrLesk/Backlog.md).

## Next steps

- **Online payment.** A booking is confirmed today without paying. With a provider such as Stripe,
  booking would hold the slot as `pending` for a few minutes, under the same no-overlap
  constraint, which would then cover pending bookings too. The provider's signed webhook would
  confirm it once paid, an expired hold would free the slot, and a cancellation within the window
  would refund the payment, whose id the booking would store.
- **A waitlist** for taken slots: whoever waits first is booked automatically when the booking is
  cancelled, in the same transaction as the cancellation, so the constraint still decides.
- **Several facilities**, each with its own time zone; today there is one, in Europe/Lisbon.
- **Telling customers.** With email notifications, admins could cancel on a customer's behalf, and
  deactivating a court could cancel its future bookings; both are left out today because no one
  would be told.
- **Idempotent booking.** When the answer to a booking request is lost and the client sends it
  again, the retry meets the user's own new booking and gets 409 `SLOT_TAKEN`. An
  `Idempotency-Key` header, stored with the booking, would return the first answer instead.
- **Observability.** The API writes Nest's plain-text log lines to the console. OpenTelemetry would
  add traces through Express and the PostgreSQL driver, metrics per route (requests, latency,
  errors, slots refused as taken, waits for a pooled connection), and JSON logs carrying each
  request's trace id, all sent to one central store, so a single booking can be followed from its
  request to its SQL.
- **Login limits in a shared store.** The per-address and per-email login limits live in the API's
  memory, so they reset on a restart and each instance would count on its own. PostgreSQL or Redis
  would hold them before the API runs on more than one instance.
- **A deployment:** HTTPS in front of nginx (the session cookie is already `Secure` with a
  `__Host-` name unless the configuration turns that off, as Compose does for plain HTTP on
  localhost), a managed PostgreSQL with backups, and migrations as a release step.
- **End-to-end tests in a browser** (Playwright) against `docker compose up`, for the flows the
  web tests now check with a stubbed API.
- **Paging the past bookings.** My bookings returns every booking a user ever made, which grows
  without limit for a regular customer.
