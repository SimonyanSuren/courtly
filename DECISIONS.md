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
