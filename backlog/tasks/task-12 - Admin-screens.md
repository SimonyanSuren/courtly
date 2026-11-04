---
id: TASK-12
title: Admin screens
status: Done
assignee:
  - '@SimonyanSuren'
  - '@claude'
created_date: '2026-11-01T23:42:00Z'
updated_date: '2026-11-04T01:25:00Z'
labels:
  - web
dependencies:
  - TASK-10
  - TASK-5
  - TASK-8
priority: high
type: feature
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Admins manage courts and follow each day's bookings from the browser.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Admins create, edit, deactivate and reactivate courts, with validation errors shown next to the fields
- [x] #2 Admins pick a date and see all bookings for it across courts, with the total expected revenue
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The screens are built against docs/api.md and tested with stubbed API responses. Court management works end to end with the courts API; the day view does once TASK-8 provides its route.

Checked in Chrome against a fresh seeded stack (docker compose, separate project on port 18080), 4 Nov 2026. The admin added a court: 'padel 1' got 'Another court already has this name.' under Name, and closing at the opening hour got 'Must be after the opening hour.' under Closing hour; Pickleball 1 was then created, its price edited to €25.50 (stored as 2550 cents), deactivated and reactivated. The day view for 4 Nov showed 4 bookings with customer and status and €82.00 expected, the cancelled €44.00 booking listed but not counted; 5 Nov likewise, with the date in the URL.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Admins create and edit courts in a dialog with errors at their fields, deactivate and reactivate them from the list, and pick a date for the day view: every booking across courts with court, time, customer, price and status, and the expected revenue of the confirmed ones. Verified in a real browser and by the web tests.
<!-- SECTION:FINAL_SUMMARY:END -->
