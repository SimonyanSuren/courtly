# Courtly

A sports facility booking platform, built as a take-home exercise.

> Work in progress: this README describes only what exists so far.

## Requirements

- Node.js 26.13, pinned in `.nvmrc`. npm refuses to install on other versions.
- Docker, for the local database and for the tests.

## Getting started

```sh
nvm use
npm ci
npm run prepare                      # installs the Git hooks (.npmrc turns off install scripts)
cp apps/api/.env.example apps/api/.env
docker compose up -d --wait postgres # PostgreSQL 18 on 127.0.0.1:5432
npm run start:dev -w apps/api        # the API on http://localhost:3000, reloading on changes
```

## Checks

Run from the repository root; each covers every workspace:

```sh
npm run lint
npm run typecheck
npm test               # starts its own PostgreSQL with Testcontainers
npm run build
npm run knip           # unused files, exports and dependencies
npm run format:check
```

Git hooks run ESLint and Prettier on staged files before each commit, check the commit message
(Conventional Commits) and type-check before each push.

## More

- [DECISIONS.md](DECISIONS.md): what was chosen, what was rejected, and why.
- [backlog/](backlog/): the tasks, tracked with [Backlog.md](https://github.com/MrLesk/Backlog.md).
