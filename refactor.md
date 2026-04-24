# Refactor Plan

## Status

Completed.

## Scope

This refactor covers six structural changes:

1. Split the chat pipeline into smaller modules.
2. Break `diagram-helpers.ts` into focused store modules.
3. Finish extracting React Flow adapter logic from the canvas layer.
4. Thin orchestration-heavy UI components.
5. Consolidate single-node and multi-node editing around shared selection editors.
6. Reduce repetitive node-action mutation boilerplate.

## Stages

### Stage 1: Chat Pipeline

Status: Completed

- Move chat state types, persistence, request lifecycle, and conversation-history building into dedicated modules.
- Keep `chat-store.ts` focused on wiring store state to chat actions.
- Add focused unit coverage for new helper modules and preserve existing chat-store behavior.

Verification:

- `npx vitest run src/store/__tests__/chat-store.test.ts src/store/__tests__/chat-stream-handlers.test.ts`

### Stage 2: Diagram Helper Decomposition

Status: Completed

- Split framework resolution, edge-routing helpers, snapshotting, and batch mutation helpers into separate store modules.
- Update store context and action modules to import from those narrower files.
- Add targeted tests where the new seams benefit from direct coverage.

Verification:

- `npx vitest run src/store/__tests__/diagram-store-diagram-actions.test.ts src/store/__tests__/apply-ai-modifications.test.ts`

### Stage 3: Canvas / React Flow Adapter

Status: Completed

- Extract local React Flow state syncing and event subscriptions out of `DiagramCanvas.tsx`.
- Keep `DiagramCanvas.tsx` as the composition shell around the adapter hooks.
- Preserve current canvas interaction behavior with targeted canvas tests.

Verification:

- `npx vitest run src/components/canvas/__tests__/DiagramCanvas.test.tsx src/hooks/__tests__/useCanvasHandlers.test.tsx`

### Stage 4: Thin Toolbar and Side Panel

Status: Completed

- Extract toolbar action/state composition into dedicated hooks/helpers.
- Extract side-panel resizing/layout state into a dedicated hook.
- Keep the components mostly declarative.

Verification:

- `npx vitest run src/components/toolbar/__tests__/Toolbar.test.tsx src/components/panel/__tests__/SidePanel.test.tsx`

### Stage 5: Shared Selection Editors

Status: Completed

- Replace duplicated single-node vs multi-node tag/junction editing logic with shared selection-based editors.
- Reuse shared selection derivation hooks where node and multi-node panels overlap.
- Preserve existing panel behavior while reducing divergence risk.

Verification:

- `npx vitest run src/components/panel/__tests__/NodePanel.test.tsx src/components/panel/__tests__/MultiNodePanel.test.tsx`

### Stage 6: Node Action Cleanup

Status: Completed

- Reduce repeated node mutation patterns inside `diagram-store-node-actions.ts`.
- Keep behavior identical while making future node-field additions cheaper.
- Add or extend focused tests only where the refactor creates a new helper seam.

Verification:

- `npx vitest run src/store/__tests__/diagram-store-node-actions.test.ts`

## Final Verification

- `npm run test:unit`
- `npm run build`
