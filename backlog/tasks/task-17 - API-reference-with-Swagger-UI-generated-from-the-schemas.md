---
id: TASK-17
title: API reference with Swagger UI, generated from the schemas
status: To Do
assignee: []
created_date: '2026-11-04T01:26:00Z'
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
- [ ] #1 Swagger UI and the OpenAPI document are served by the API under /api, also through nginx
- [ ] #2 Request bodies, query and path parameters come from the existing Zod schemas
- [ ] #3 Every route documents its success response and its error responses with their codes, in the Problem Details format
- [ ] #4 Session-cookie login works from Swagger UI, so protected routes can be tried
- [ ] #5 A test fails when a route is missing from the document
<!-- AC:END -->
