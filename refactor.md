# Refactor Plan

## Goals

- Reduce coupling between UI components, stores, and domain logic.
- Move side effects into explicit bootstrap or adapter layers.
- Split oversized orchestration components into focused hooks/modules.
- Improve type safety around framework/provider/transition identifiers.
- Keep behavior stable while making future features easier to add.

## Guiding Rules

- Prefer extracting boundaries over rewriting working logic.
- Keep `core/` free of React/UI concerns.
- Keep `components/` focused on rendering and interaction wiring.
- Keep stores focused on state transitions, not cross-layer orchestration.
- Land changes in small phases with tests preserved at each step.

## Phase 1: Fix Layer Boundaries Around Chat

### Problem

`src/store/chat-store.ts` depends on `src/components/panel/chat-mentions.ts`, which means store logic depends on UI-layer parsing and display shaping.

### Changes

- Move chat mention parsing/render-data helpers into `src/core/chat/` or `src/features/chat/`.
- Keep canonical chat state in the store:
  - raw message content
  - retry metadata
  - modification payloads
- Compute display segments in the UI or in a domain-level formatter module, not in the store.
- Move `applyModifications` into a dedicated chat application service or command module.

### Target Shape

- `core/chat/mentions.ts`
- `core/chat/message-format.ts`
- `store/chat-store.ts` only coordinates request lifecycle and persisted state
- `components/panel/chat/*` renders formatted messages without owning parsing rules

### Acceptance Criteria

- No files under `src/store/` import from `src/components/`.
- Chat mention parsing tests still pass.
- Chat UI output remains unchanged for valid, malformed, and streaming mentions.

## Phase 2: Introduce an Application Layer for Cross-Store Workflows

### Problem

Diagram actions currently trigger UI behavior directly through `useUIStore`, which mixes domain mutations with toasts, focus, and viewport requests.

### Changes

- Add an application layer such as `src/app/commands/` or `src/features/diagram/commands/`.
- Move workflows like these out of the diagram store:
  - auto-layout + error toast
  - derive-next-diagram + fit-view
  - framework switching + initial focus
  - AI modifications + relayout + focus/update handling
- Keep the diagram store responsible for pure state mutations and history.
- Let command handlers call both diagram and UI stores explicitly.

### Candidate Commands

- `runAutoLayoutCommand()`
- `deriveNextDiagramCommand()`
- `setFrameworkCommand()`
- `applyAiDiagramModificationsCommand()`

### Acceptance Criteria

- Diagram store no longer imports `useUIStore`.
- Main workflows remain covered by existing tests or replacement command tests.
- Diagram mutations can be tested without asserting on UI side effects.

## Phase 3: Centralize Bootstrap and Browser Side Effects

### Problem

Startup behavior is spread across `main.tsx`, `App.tsx`, store module top-level code, and hooks. That makes boot order harder to reason about and increases hidden side effects on import.

### Changes

- Create a bootstrap module, for example `src/app/bootstrap.ts`.
- Centralize:
  - initial theme hydration
  - global error logging install
  - diagram session restore
  - settings startup model refresh
  - storage event subscriptions
- Replace module-level side effects in stores with explicit startup functions.
- Keep browser storage access behind small adapters.

### Candidate Modules

- `app/bootstrap.ts`
- `app/startup/load-session.ts`
- `app/startup/init-theme.ts`
- `adapters/storage/settings-storage.ts`
- `adapters/storage/chat-storage.ts`

### Acceptance Criteria

- Importing a store module does not attach global listeners or kick off network requests.
- App startup order is explicit from one entry path.
- Existing persistence and theme behavior remain unchanged.

## Phase 4: Split `DiagramCanvas` Into Focused Hooks

### Problem

`src/components/canvas/DiagramCanvas.tsx` is carrying too many responsibilities and is the most likely place for regressions when interaction logic changes.

### Changes

- Extract focused hooks/modules:
  - `useCanvasSelectionSync`
  - `useCanvasViewportFocus`
  - `useBufferedGraphRemovals`
  - `useCanvasTouchGestures`
  - `useCanvasFitViewRequests`
- Keep `DiagramCanvas` as a composition layer around React Flow.
- Move geometry helpers into a small utility module if they are reused.

### Suggested End State

- `DiagramCanvas.tsx` becomes mostly:
  - store selectors
  - React Flow props wiring
  - rendering
- Hook modules own interaction details and effect cleanup

### Acceptance Criteria

- `DiagramCanvas.tsx` is materially smaller and easier to scan.
- Existing canvas tests still pass.
- No behavior change in drag, selection, touch, fit-view, or focus behavior.

## Phase 5: Extract Panel Resize/Split Behavior

### Problem

`SidePanel` mixes presentation, selected-object branching, and drag-resize logic.

### Changes

- Extract resize/split behavior into reusable hooks:
  - `useHorizontalPanelResize`
  - `useVerticalPanelSplit`
- Keep `SidePanel` responsible for choosing which panel content to render.
- Optionally persist panel width/layout mode later, but only after the extraction.

### Acceptance Criteria

- `SidePanel.tsx` mostly reads as layout/render logic.
- Pointer event cleanup remains correct.

## Phase 6: Strengthen Type Safety for Registries

### Problem

Framework IDs, provider IDs, and transition IDs are mostly raw strings. That creates avoidable runtime branching and makes refactors riskier.

### Changes

- Convert framework/provider/transition definitions to `as const` registries where practical.
- Derive union types:
  - `FrameworkId`
  - `ProviderId`
  - `DiagramTransitionId`
- Tighten APIs that currently accept plain `string`.
- Add helper guards only where external input enters the system.

### Acceptance Criteria

- Internal APIs use typed identifiers instead of generic strings.
- Fewer `undefined` fallbacks are needed in internal paths.

## Recommended Order

1. Phase 1: Chat boundary cleanup
2. Phase 2: Application-layer commands
3. Phase 3: Bootstrap and side-effect centralization
4. Phase 4: `DiagramCanvas` split
5. Phase 5: `SidePanel` split
6. Phase 6: Registry typing pass

## Rollout Notes

- Do not combine all phases in one PR.
- Prefer behavior-preserving extractions first, then boundary tightening.
- After each phase, run:
  - `npm run test:unit`
  - `npm run build`
- If a phase changes interaction behavior, also run the relevant Playwright coverage.

## First PR Recommendation

Start with Phase 1.

Why:

- It fixes a clear architectural violation.
- It is relatively contained.
- It creates a better pattern for later extraction work.
- It lowers the chance that future chat changes further entangle store and UI code.
