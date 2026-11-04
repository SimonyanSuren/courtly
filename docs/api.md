# Courtly API

The contract between the web app and the API. Every path starts with `/api`. Requests and
responses are JSON; errors are Problem Details (RFC 9457).

## Conventions

- **Sessions:** `POST /api/auth/login` starts a session kept in an httpOnly cookie, which the
  browser sends with every request. Every route needs a session unless it is marked _public_:
  without one the answer is 401 with the code `UNAUTHORIZED`, and with the wrong role it is 403
  with the code `FORBIDDEN`.
- **Roles:** a `user` browses courts, books and cancels; an `admin` manages courts and sees every
  booking. Admins do not book. Each route lists the role it needs.
- **Times:** moments are ISO 8601 strings with the facility's offset from UTC, for example
  `2026-11-05T18:00:00+00:00` in winter and `2026-07-05T18:00:00+01:00` in summer (Europe/Lisbon).
  Requests may use any offset or `Z`. A date is a calendar day in Europe/Lisbon: `2026-11-05`.
- **Money:** integer euro cents, such as `1500` for €15.00.
- **Cross-origin requests:** state-changing requests from another origin get 403. The web app is
  served from the same origin as the API.
- **Versions:** none. The web app and the API ship together, so the API changes additively: a
  field is renamed or removed only once the web app no longer reads it.

## Errors

Every error has the content type `application/problem+json`:

```json
{
  "type": "about:blank",
  "title": "Conflict",
  "status": 409,
  "detail": "Someone else booked this court for that time.",
  "code": "SLOT_TAKEN"
}
```

`detail` is a sentence a user can read; `code` stays stable for programs. A 400 with the code
`VALIDATION_FAILED` also lists each invalid value in `errors`:
`{ "in": "body" | "query" | "param", "path": "hours", "message": "Must be 1 or 2." }`. Each
`message` is a sentence to show next to the field, with amounts in euros: "Must be at most
€1,000.00 an hour."

| Status | Meaning                                                     |
| ------ | ----------------------------------------------------------- |
| 400    | The request is malformed or has invalid values              |
| 401    | No valid session, or wrong email or password at login       |
| 403    | The role may not use this route, or a cross-origin request  |
| 404    | No such resource, or not one this user may see              |
| 409    | The request conflicts with the current state                |
| 422    | The request is well formed but breaks a booking rule        |
| 429    | Too many login attempts; the `Retry-After` header says when |

## Types

```ts
type Role = 'user' | 'admin';
type Sport = 'padel' | 'tennis' | 'squash' | 'badminton' | 'pickleball';

interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

interface Court {
  id: string;
  name: string; // trimmed, 1 to 100 characters, unique ignoring case
  sport: Sport;
  hourlyPriceCents: number; // 1 to 100000 (€1,000.00)
  openingHour: number; // 0 to 23
  closingHour: number; // 1 to 24, after openingHour; 24 is the midnight that ends the day
  active: boolean;
}

interface Slot {
  startsAt: string;
  endsAt: string;
  // started: it starts at or before now, booked or not; taken: a confirmed booking covers it.
  status: 'available' | 'taken' | 'started';
}

interface Booking {
  id: string;
  court: { id: string; name: string; sport: Sport };
  startsAt: string;
  endsAt: string;
  hours: 1 | 2;
  priceCents: number; // the court's hourly price when booked, times hours
  status: 'confirmed' | 'cancelled';
  cancellableUntil: string; // startsAt minus 2 hours
  createdAt: string; // when the booking was stored
  cancelledAt: string | null;
}

interface AdminBooking extends Booking {
  user: { id: string; name: string; email: string };
}
```

## Routes

### Login

| Route                   | Role   | Body                  | Success                                     | Errors                                                   |
| ----------------------- | ------ | --------------------- | ------------------------------------------- | -------------------------------------------------------- |
| `POST /api/auth/login`  | public | `{ email, password }` | 200 `User`, and the session cookie is set   | 401 `INVALID_CREDENTIALS`, 429 `TOO_MANY_LOGIN_ATTEMPTS` |
| `POST /api/auth/logout` | public |                       | 204, the session ends and the cookie clears |                                                          |
| `GET /api/auth/me`      | any    |                       | 200 `User`                                  |                                                          |
| `GET /api/health`       | public |                       | 200 `{ "status": "ok" }`                    | 503 when the database is down                            |

### Courts

| Route                   | Role  | Body                                                                               | Success                                                      | Errors                                                       |
| ----------------------- | ----- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `GET /api/courts`       | any   |                                                                                    | 200 `Court[]` by name: active ones for users, all for admins |                                                              |
| `GET /api/courts/:id`   | any   |                                                                                    | 200 `Court`                                                  | 404 `COURT_NOT_FOUND`, also for an inactive court and a user |
| `POST /api/courts`      | admin | `{ name, sport, hourlyPriceCents, openingHour, closingHour }`                      | 201 `Court`, active                                          | 400, 409 `COURT_NAME_TAKEN`                                  |
| `PATCH /api/courts/:id` | admin | Any of `name`, `sport`, `hourlyPriceCents`, `openingHour`, `closingHour`, `active` | 200 `Court`                                                  | 400, 404 `COURT_NOT_FOUND`, 409 `COURT_NAME_TAKEN`           |

Courts are never deleted. `{ "active": false }` deactivates a court and keeps its bookings;
`{ "active": true }` reactivates it. New opening hours apply to new bookings only.

- Names compare ignoring case and the spaces around them: "Padel 1" and " padel 1" are taken by
  the same court.
- An id that is not a UUID answers 404 `COURT_NOT_FOUND`, as an unknown one does.
- `PATCH` checks the opening hours as they will be after the change. A court that would not open
  before it closes answers 400 with the error at `closingHour`.
- An empty `PATCH` answers the court unchanged.

### Availability

| Route                                        | Role | Success                                     | Errors                                     |
| -------------------------------------------- | ---- | ------------------------------------------- | ------------------------------------------ |
| `GET /api/courts/:id/availability?date=DATE` | user | 200 `{ court: Court, date, slots: Slot[] }` | 400, 404 `COURT_NOT_FOUND` (also inactive) |

The slots run from opening to closing, 1 hour each, in order. On the days the clocks change, a
court open all day has 23 or 25 of them.

### Bookings

| Route                           | Role | Body                           | Success                                        | Errors                                                                                                          |
| ------------------------------- | ---- | ------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `POST /api/bookings`            | user | `{ courtId, startsAt, hours }` | 201 `Booking`                                  | 400, 404 `COURT_NOT_FOUND`, 409 `SLOT_TAKEN`, 422 `NOT_ON_THE_HOUR`, `OUTSIDE_OPENING_HOURS`, `ALREADY_STARTED` |
| `GET /api/bookings`             | user |                                | 200 `{ upcoming: Booking[], past: Booking[] }` |                                                                                                                 |
| `POST /api/bookings/:id/cancel` | user |                                | 200 `Booking`, now cancelled                   | 404 `BOOKING_NOT_FOUND`, 409 `BOOKING_ALREADY_CANCELLED`, 422 `CANCELLATION_WINDOW_CLOSED`                      |

- `hours` is 1 or 2, and `startsAt` must be on the hour.
- `hours` other than 1 or 2, or a `courtId` that is not a UUID, answers 400 at that field.
- An `:id` that is not a UUID answers 404 `BOOKING_NOT_FOUND`, as an unknown one does.
- `GET /api/bookings` returns the caller's own bookings, cancelled ones included. `upcoming` holds
  those that have not ended, soonest first; `past` those that have, most recent first.
- Cancelling is allowed up to and including `cancellableUntil`. Another user's booking answers
  404, as if it did not exist.

### Admin day view

| Route                               | Role  | Success                                                        | Errors |
| ----------------------------------- | ----- | -------------------------------------------------------------- | ------ |
| `GET /api/admin/bookings?date=DATE` | admin | 200 `{ date, bookings: AdminBooking[], expectedRevenueCents }` | 400    |

Every booking that starts on that date, at any court including inactive ones, ordered by court
name and then start time. Cancelled bookings are listed; `expectedRevenueCents` sums only the
confirmed ones, each at its booked price.
