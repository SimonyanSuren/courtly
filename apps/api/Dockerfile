# syntax=docker/dockerfile:1.28.0@sha256:bb22d9815c728170f72750f4e5b0d672e06176142e1d602c7e66c050100b7e5b
# check=error=true

# The API's production image. The build context is the repository root, which holds the lockfile
# every workspace shares: `docker build -f apps/api/Dockerfile .`, as compose.yaml does. The files
# it may read are allowlisted in Dockerfile.dockerignore, next to this file.

# The frontend is pinned, not floating on docker/dockerfile:1: with check=error=true, a new
# release that adds a check would otherwise start failing builds that did not change.

# Pinned by digest for reproducible builds; the tag is kept for readability and updated together
# with the digest. Keep the Node version in sync with .nvmrc.
FROM node:26.13.0-trixie-slim@sha256:e4db4c914bf8ad241bd24804fc25d272d89bad97e68cdc8a1414862790a02c39 AS base
WORKDIR /app


# ---- build: the API's dependencies, dev included, and the compiled output ----------------------
FROM base AS build

# Manifests first, so the install layer is reused until a manifest or the lockfile changes.
# .npmrc carries ignore-scripts=true: no install script runs, neither a dependency's nor the
# root's `prepare` (husky).
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/
# --workspace installs the API's dependencies only, without the root's linters and git hooks.
# The compiler comes with @nestjs/cli, which depends on TypeScript: the lockfile holds one copy,
# the version the root pins.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace apps/api --no-audit --no-fund

COPY tsconfig.base.json ./
COPY apps/api/nest-cli.json apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/
COPY apps/api/src apps/api/src
RUN npm run build --workspace apps/api


# ---- prod-deps: the API's runtime dependencies only (built in parallel with `build`) ----------
FROM base AS prod-deps

COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace apps/api --omit=dev --no-audit --no-fund
# Type definitions never run. --omit=dev keeps @types/node and @types/pg because drizzle-orm
# lists @types/pg as an optional peer, which the lockfile marks devOptional instead of dev.
RUN rm -rf node_modules/@types


# ---- runtime ------------------------------------------------------------------------------------
FROM base AS runtime

ENV NODE_ENV=production

# The repository layout is kept: Node finds the dependencies in /app/node_modules from the API's
# folder, and migrations/ sits next to dist/, where the migrator looks for it.
# Files stay owned by root and read-only to the app user: a compromised process cannot rewrite
# its own code or dependencies.
COPY --from=prod-deps /app/node_modules ./node_modules
WORKDIR /app/apps/api
# Declares "type": "commonjs" for dist/.
COPY apps/api/package.json ./
COPY --from=build /app/apps/api/dist ./dist
COPY apps/api/migrations ./migrations

# The image's `node` user, by UID: Kubernetes runAsNonRoot can only verify a numeric user.
USER 1000:1000

EXPOSE 3000

# /api/health also queries the database, so healthy means ready to serve requests.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --start-interval=2s --retries=3 \
    CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT ?? 3000}/api/health`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

LABEL org.opencontainers.image.title="courtly-api" \
      org.opencontainers.image.description="Courtly REST API: courts, availability and bookings." \
      org.opencontainers.image.source="https://github.com/SimonyanSuren/courtly"

# Exec form, with no shell or npm in front, and the base image's entrypoint script ends in
# `exec`: Node runs as PID 1 and receives `docker stop`'s SIGTERM itself. No init process such as
# tini: main.ts handles SIGTERM and SIGINT (enableShutdownHooks) and the API spawns no child
# processes, so there is nothing to forward or reap.
CMD ["node", "--enable-source-maps", "dist/main.js"]
