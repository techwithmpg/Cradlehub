# CURRENT TASK: Fix CRM Home-Service Toggle Persistence and Booking Wizard Filtering

## Status
IN_PROGRESS

## Task ID
CRM-HOME-SVC-PERSIST-001

## Confirmed Schema
branch_services.available_home_service (boolean, default false) — home service flag
branch_services.visibility (text, default 'public', CHECK in ('public','internal','hidden')) — NOT booking_visibility

## Symptom
Toggle turns OFF after page refresh = not persisting to DB, or reading from wrong field on reload.
