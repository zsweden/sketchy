# Refactor Plan

Architectural improvement opportunities identified 2026-04-06. Ordered by impact.

## Status

| # | Opportunity | Priority | Status |
|---|-------------|----------|--------|
| 1 | Chat-store / diagram-store coupling | High | Phase 1 done; Phase 2 pending |
| 2 | EntityNode complexity | Medium | Not started |
| 3 | Layout metrics hotspot | Medium | Not started |
| 4 | E2E test depth | Medium | Done (55 tests, +6 covering save/load, mixed undo/redo, AI batch, multi-drag, reconnect, CLD cycles) |
| 5 | Error handling consistency | Low | Not started |

## Strengths to Preserve

These are working well and should not be disrupted by refactoring:

- **Core/UI boundary** — `src/core/` has zero React/Zustand imports. Perfect separation.
- **Framework registry** — Adding a framework requires only a definition file and one registration call.
- **Store decomposition** — `diagram-store` is split across 4 focused action modules. No god objects.
- **Type safety** — Zero `any` types in the entire codebase. `unknown` casts are justified and minimal.
- **Migration pipeline** — Stateless, composable migration functions in `src/core/persistence/`.
- **Hook extraction** — Large components already delegate to custom hooks (viewport focus, highlighting, gestures).

---

## 1. Chat-Store / Diagram-Store Coupling

### Problem

`chat-store.ts` (501 LOC) calls `useDiagramStore.getState()` directly to read diagram state and apply AI mutations. This creates tight bidirectional coupling between the two largest stores, making chat logic hard to test in isolation.

### Done (Phase 1)

Chat mention parsing moved from `src/components/panel/` to `src/core/chat/mentions.ts`. Store no longer imports from `components/`.

### Remaining (Phase 2)

Introduce a diagram operations service that both stores consume:

- Create `src/core/diagram-operations.ts` (or `src/app/commands/`).
- Move cross-store workflows out of chat-store:
  - AI modifications + relayout + focus
  - auto-layout + error toast
  - framework switching + initial focus
- Diagram store stays responsible for pure state mutations and history.
- Chat store describes *what* to change; the service executes it.

### Acceptance Criteria

- `chat-store.ts` does not import `useDiagramStore`.
- Diagram mutations can be tested without asserting on chat or UI side effects.
- AI modification workflow remains functionally identical.

---

## 2. EntityNode Complexity

### Problem

`EntityNode.tsx` (388 LOC) combines rendering, inline editing, touch/pointer gesture handling, and connection handle visibility logic. The touch layer (multitouch, double-tap detection, proximity-based handles) is complex enough to warrant its own module.

### Changes

- Extract `useTouchNodeInteraction` hook for pointer/touch gesture logic.
- Keep EntityNode focused on rendering, accent colors, derived badges, and editing state.
- Target: EntityNode drops to ~280 LOC.

### Acceptance Criteria

- EntityNode.tsx is under 300 LOC.
- All existing canvas interaction tests pass.
- No behavior change in touch, tap, edit, or handle visibility.

---

## 3. Layout Metrics Hotspot

### Problem

`layout-metrics.ts` (257 LOC) handles collision detection, bounding box computation, and CLD-specific metrics in one file. These are distinct concerns that change for different reasons.

### Changes

- Extract collision/bbox logic into `src/core/layout/collision-detection.ts`.
- Keep CLD-specific metrics (loop readability, spacing) in `layout-metrics.ts`.
- Add unit tests for collision detection in isolation.

### Acceptance Criteria

- `layout-metrics.ts` under 150 LOC.
- Collision detection is independently testable.
- Layout output unchanged for all framework types.

---

## 4. E2E Test Depth

### Problem

770 unit tests but only 49 Playwright E2E tests (48 in `app.spec.ts`, 1 in `touch.mobile.spec.ts`). Critical user workflows are heavily covered at the unit level but barely exercised in a real browser.

### Coverage Gaps

The following workflows lack E2E coverage:

- Save/load round-trip (native file dialog + `.sky` format)
- AI chat mutations applied to canvas
- Framework switching mid-diagram
- Undo/redo across mixed operations (drag, edit, delete, AI apply)
- Multi-node selection + bulk operations
- Edge creation and validation (cycle rejection, duplicate rejection)

### Changes

- Add E2E specs for each gap above in `e2e/`.
- Target: 100+ meaningful E2E test cases.
- Prioritize save/load and undo/redo — these are the highest-risk user workflows.

### Acceptance Criteria

- Each workflow above has at least one happy-path and one error-case E2E test.
- E2E suite runs in CI and blocks merges on failure.

---

## 5. Error Handling Consistency

### Problem

Error handling varies across the codebase. `sky-io.ts` uses try/catch with user-facing toasts. Chat-store subscriptions swallow errors silently. AI streaming failures sometimes surface, sometimes don't.

### Changes

- Establish a pattern: all async operations that can fail surface errors through the toast system or a dedicated error channel.
- Audit chat-store, persistence, and AI client for silent failures.
- Wire failures through `src/core/monitoring/error-logging.ts` consistently.

### Acceptance Criteria

- No silent `catch` blocks that discard errors without logging or user notification.
- Error logging module is used consistently across async boundaries.

---

## Recommended Order

1. **Phase 2** (chat-store decoupling) — highest architectural leverage
2. **EntityNode extraction** — straightforward hook extraction
3. **Layout metrics split** — small, testable change
4. **E2E test depth** — can run in parallel with any phase
5. **Error handling** — lowest priority, do opportunistically

## Rollout Notes

- One PR per opportunity. Do not combine.
- Run `npm run lint && npx tsc -b && npm run test:all` after each change.
- Behavior-preserving extractions first, then tighten boundaries.
