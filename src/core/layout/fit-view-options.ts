/**
 * Shared fitView options used across all fitView call sites.
 *
 * IMPORTANT: Every fitView invocation must use these options to ensure
 * auto-layout, load, and the Controls fit-view button produce identical
 * zoom/centering. See layout-consistency.test.ts for regression tests.
 */
export const FIT_VIEW_OPTIONS = {
  padding: 0.15,
  duration: 300,
  maxZoom: 1.5,
} as const;
