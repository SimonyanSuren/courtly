# syntax=docker/dockerfile:1.28.0@sha256:bb22d9815c728170f72750f4e5b0d672e06176142e1d602c7e66c050100b7e5b
# check=error=true

# The web app's production image: the built static files, served by nginx, which also passes
# /api/ to the API. The build context is the repository root, which holds the lockfile every
# workspace shares: `docker build -f apps/web/Dockerfile .`, as compose.yaml does. The files it
# may read are allowlisted in Dockerfile.dockerignore, next to this file.

# The frontend is pinned, not floating on docker/dockerfile:1: with check=error=true, a new
# release that adds a check would otherwise start failing builds that did not change.


# ---- build: the web app's dependencies, dev included, and the bundle ---------------------------
# The API's Node image, pinned by digest for reproducible builds; the tag is kept for readability
# and updated together with the digest. Keep the Node version in sync with .nvmrc.
FROM node:26.13.0-trixie-slim@sha256:e4db4c914bf8ad241bd24804fc25d272d89bad97e68cdc8a1414862790a02c39 AS build
WORKDIR /app

# Manifests first, so the install layer is reused until a manifest or the lockfile changes.
# .npmrc carries ignore-scripts=true: no install script runs, neither a dependency's nor the
# root's `prepare` (husky).
COPY package.json package-lock.json .npmrc ./
COPY apps/web/package.json apps/web/
# --workspace installs the web app's dependencies only, without the root's linters and git hooks.
# Vite and its React plugin are devDependencies, which the build needs; none reach the runtime.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace apps/web --no-audit --no-fund

# Vite takes compiler options such as jsx from the tsconfig files, and the app's extends the
# root's, so the bundle comes out as `npm run build` makes it locally.
COPY tsconfig.base.json ./
COPY apps/web/tsconfig.json apps/web/tsconfig.app.json apps/web/tsconfig.node.json \
     apps/web/vite.config.ts apps/web/index.html apps/web/
COPY apps/web/src apps/web/src
RUN npm run build --workspace apps/web


# ---- runtime: nginx and the built files, nothing else -------------------------------------------
# nginx's own unprivileged image: it runs as UID 101, listens on 8080 and keeps its pid and
# temporary files in /tmp, so it needs no root and a read-only filesystem works with one tmpfs.
# The slim Alpine variant leaves out the optional modules (njs, image filter, XSLT, GeoIP) and
# curl, which a static site does not need. Pinned by digest, like the Node image.
FROM nginx/nginx-unprivileged:1.30.6-alpine-slim@sha256:016193c18ef1ce19dc2229d3305f69af1b05e0bc0e8fe6ee724a58bd305f3855 AS runtime

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
# A folder of its own: the image's html folder also holds nginx's sample pages. The files stay
# owned by root and read-only to nginx, so a compromised worker cannot rewrite the app.
COPY --from=build /app/apps/web/dist /srv/courtly

# The base image already runs as this user; stated here so the guarantee does not depend on it.
# By UID: Kubernetes runAsNonRoot can only verify a numeric user.
USER 101:101

# The fallback serves index.html for /, so healthy means nginx is up and serving the build. The
# API has its own health check; this one does not depend on it. busybox provides wget.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --start-interval=1s --retries=3 \
    CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/"]

LABEL org.opencontainers.image.title="courtly-web" \
      org.opencontainers.image.description="Courtly web app: login, court booking and administration in the browser." \
      org.opencontainers.image.source="https://github.com/SimonyanSuren/courtly"

# The base image's entrypoint and command stay: its scripts end in `exec nginx`, so nginx runs as
# PID 1, and its STOPSIGNAL is SIGQUIT, on which nginx finishes open requests before it exits.
