/**
 * MVP feature flags.
 *
 * These flags are compile-time constants. Flip the value and re-deploy to
 * enable/disable the feature. Do not use environment variables for these —
 * they are intentional product decisions, not deployment-time config.
 *
 * When re-enabling check-in/check-out after MVP:
 *   1. Set MVP_CHECKIN_PAUSED = false
 *   2. Update crm-availability.ts presenceStatus logic
 *   3. Restore recommendation-engine.ts notCheckedIn score
 *   4. Restore crm-readiness.ts getAssignedDriverNotCheckedInIssue
 *   5. Restore check-in/out buttons in crm-availability-board.tsx and crm-availability-client.tsx
 */

/** When true, daily check-in/check-out is paused. Availability is schedule-based only. */
export const MVP_CHECKIN_PAUSED = true;
