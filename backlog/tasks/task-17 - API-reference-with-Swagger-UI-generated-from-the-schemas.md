---
id: TASK-17
title: API reference with Swagger UI, generated from the schemas
status: Done
assignee: []
created_date: '2026-11-04T01:26:00Z'
updated_date: '2026-11-04T13:03:00Z'
labels:
  - api
  - docs
dependencies: []
priority: medium
type: feature
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let anyone try every API route and see its request, response and error shapes without reading the code, generated from the Zod schemas the API already validates with, so the reference cannot drift from the code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Swagger UI and the OpenAPI document are served by the API under /api, also through nginx
- [x] #2 Request bodies, query and path parameters come from the existing Zod schemas
- [x] #3 Every route documents its success response and its error responses with their codes, in the Problem Details format
- [x] #4 Session-cookie login works from Swagger UI, so protected routes can be tried
- [x] #5 A test fails when a route is missing from the document
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Checked in Chrome through nginx on a fresh seeded stack: Swagger UI at /api/docs renders the 13 operations with locks on the session routes, no console errors; POST /api/auth/login from Try it out answered 200 and GET /api/bookings then answered 200 with Ana's bookings, the httpOnly cookie sent by the browser. test/api-docs.spec.ts (7 tests) compares the documented routes with Express's, requires a summary and one success response each, checks problem+json for every error and 401 exactly where the reference shows the lock. Error examples use the API's own sentences (Zod's defaults were replaced the same day).

Criterion 2: bodies and query strings come from the Zod schemas; path ids are validated by ParseUUIDPipe, not Zod, so the reference shows them as plain strings (a uuid format there would make Swagger UI refuse a malformed id before the API answers its 404).

Each route now has one @ApiRoute in place of @ApiOperation, a success decorator, @ApiErrors and @ApiSession; the generated document is the same route for route, plus OpenAPI's default response (the 500) on every route, which a test now requires. VALIDATION_FAILED and UNAUTHORIZED moved to HttpError in platform/http, so the session decorator could move to platform/api-docs.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
@nestjs/swagger 12.1 serves Swagger UI at /api/docs and OpenAPI 3.0 at /api/docs/openapi.json, built from the routes' Zod schemas via Standard JSON Schema; response shapes are Zod schemas, one dto/<name>.response.ts each, with inferred types checked against the database types with satisfies. One @ApiRoute per route gives its summary, success response, the errors the code throws and whether it needs the session, plus a default response for any other error. The production image drops TypeScript, which the package pulls in as an optional peer. nginx's CSP allows data: images for Swagger UI's icons.
<!-- SECTION:FINAL_SUMMARY:END -->
