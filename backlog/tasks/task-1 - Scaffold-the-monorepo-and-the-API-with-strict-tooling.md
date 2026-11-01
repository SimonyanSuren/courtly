---
id: TASK-1
title: Scaffold the monorepo and the API with strict tooling
status: Done
assignee:
  - '@SimonyanSuren'
  - '@claude'
created_date: '2026-11-01T16:46:00Z'
updated_date: '2026-11-01T23:08:00Z'
labels:
  - tooling
dependencies: []
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Courtly needs one repository for the API and the web app. Every commit is type-checked, linted and in Conventional Commits from the first one, so the history stays reviewable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 npm workspaces with the API in apps/api; one install and each quality gate run from the root
- [x] #2 The API is NestJS 12 on Node 26 with TypeScript 6 in strict mode, and a type error fails its build
- [x] #3 Type-aware ESLint and Prettier fail on any warning; knip reports unused files, exports and dependencies
- [x] #4 commitlint enforces Conventional Commits; lint-staged runs on commit and the typecheck on push
- [x] #5 Dependencies are pinned exactly, install scripts are disabled and the Node version is enforced
- [x] #6 The built API boots
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
npm workspaces with a NestJS 12 API in apps/api, on Node 26 and TypeScript 6 (strict, plus exactOptionalPropertyTypes and noUncheckedIndexedAccess), built by Nest's default tsc compiler. The ESLint config is split into rules for every workspace and Node rules for the API; configs are .mjs so root tooling needs no tsconfig; dependencies are on their latest compatible versions as of 2026-11-01. A minimal README covers running the API and the checks. Verified: typecheck, build, lint, prettier and knip pass from the root; a type error fails the build; spec files stay out of dist; a probe file with known violations is rejected by lint; commitlint rejects a message without a type; npm refuses to install on a Node version outside engines; lint-staged runs on the staged files; the built API and the watch mode boot and answer without an X-Powered-By header.
<!-- SECTION:FINAL_SUMMARY:END -->
