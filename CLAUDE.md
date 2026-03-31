# Sketchy

A web-based thinking-frameworks diagram editor focused on structured reasoning. The architecture is framework-agnostic, and the app currently ships with Current Reality Tree (CRT), Future Reality Tree (FRT), Prerequisite Tree (PRT), Success Tree, Strategy & Tactics Tree (STT), and Causal Loop Diagram (CLD).

## Working Principles

### Honesty & Collaboration
- Say if an approach has flaws, will cause bugs, or contradicts existing patterns. Be a collaborator, not a yes-man.
- Stop and re-plan after 2-3 failed attempts. Don't brute-force.

### Testing
- TDD by default — write failing tests before implementation when practical.
- Every bug fix must include a test proving it's fixed and preventing regression.
- Every new feature must ship with tests — no exceptions, even for "small" UI changes. Add unit tests for new logic/state and E2E tests for new user-facing behavior.
- Never modify tests to make them pass — investigate the root cause.
- Verify before done: `npm run lint && npx tsc --noEmit && npx vitest run`.

### Architecture
- Core must stay framework-agnostic. All framework-specific logic belongs in `src/frameworks/` config objects, never in core modules. No `frameworkId ===` conditionals in core.
- Keep functions under ~80 lines. Decompose longer ones.
- No compatibility helpers or workarounds — fix the root cause.
- Prefer framework additions that fit the current DAG model. Diagram types that require cycles or new structural primitives are product-level decisions, not just config work.
- Keep cyclic layout logic isolated to `src/core/layout/`. Loop-specific placement, SCC handling, and cyclic heuristics must not change graph routing, stores, persistence, or UI code.

### Self-Improvement
- Track rules that would have prevented bugs. After a 2nd occurrence, promote to this CLAUDE.md.

## Commands

```bash
npm run dev          # Start dev server (Vite, http://localhost:5173)
npm run build        # Production build
npm run lint         # ESLint
npx vitest run       # Run unit tests
npm run test:e2e     # Run Playwright E2E tests
npm run test:all     # Run unit + E2E tests together
npx tsc --noEmit     # Type check
```

### Post-Change Verification
After every code change, run the full verification suite before committing:
```bash
npm run lint && npx tsc --noEmit && npm run test:all
```

## Tech Stack

- React + TypeScript + Vite
- React Flow (@xyflow/react) — diagram canvas, pan/zoom, node drag, edge connections
- ELK (`elkjs`) — auto-layout engine (lazy-loaded)
- Zustand — state management (diagram-store, ui-store, settings-store, chat-store)
- Tailwind CSS v4 plus project CSS
- Lucide React — icons

## Architecture

### Core (framework-agnostic)
- `src/core/types.ts` — Diagram, DiagramNode, DiagramEdge data model
- `src/core/framework-types.ts` — Framework, NodeTag, DerivedIndicator interfaces
- `src/core/graph/validation.ts` — DAG enforcement (no cycles, self-loops, duplicate edges)
- `src/core/graph/derived.ts` — Compute node indicators from graph topology (root cause = indegree 0, etc.)
- `src/core/history/undo-redo.ts` — Generic undo/redo with snapshot stack
- `src/core/layout/` — Auto-layout with pluggable engine interface. Tree and cyclic layout engines live here behind a shared boundary; ELK is lazy-loaded on first use
- `src/core/persistence/` — session autosave, `.sky` file save/load, schema migrations, legacy format support

### Stores (Zustand)
- `src/store/diagram-store.ts` — Active diagram state, CRUD operations, undo/redo, batch updates for AI changes
- `src/store/ui-store.ts` — Selection, context menu, toasts, interaction mode (select/pan), side panel
- `src/store/settings-store.ts` — API key, base URL, model, settings popover state
- `src/store/chat-store.ts` — AI chat transcript, streaming state, AI-applied mutations

### Components
- `src/components/canvas/DiagramCanvas.tsx` — React Flow wrapper. Uses local state for RF selection, syncs from store via useEffect. Key: `localNodes`/`localEdges` preserve RF selection while reflecting store data changes.
- `src/components/canvas/EntityNode.tsx` — Custom node: left accent border (tag color > derived color > default), inline editing, notes-aware sizing, derived badges, junction indicator
- `src/components/toolbar/Toolbar.tsx` — Header: framework selector, new/layout/undo/redo, select/pan toggle, Load/Save/Print, settings, side-panel toggle
- `src/components/panel/` — Side panel: NodePanel, EdgePanel, SettingsPanel, ChatPanel
- `src/components/context-menu/ContextMenu.tsx` — Right-click menu for nodes (tags, junction, delete) and edges (delete)

### Frameworks
- `src/frameworks/crt.ts` — CRT definition: UDE tag, root-cause/intermediate derived indicators
- `src/frameworks/frt.ts` — FRT definition: injection/DE tags, foundation/intermediate derived indicators
- `src/frameworks/registry.ts` — Framework registry (getFramework, listFrameworks, registerFramework)

## Design System

Matches the Bricky project design:
- Fonts: DM Sans (body), Playfair Display (app title)
- Color palette: warm neutrals (#F5F5EC bg, #212121 accent, #E8E4DA secondary)
- Buttons: fully rounded, uppercase. Load/Save = secondary text buttons, Print = primary text button
- CSS custom properties defined in `src/index.css` (:root block)

## Key Patterns

- **Node tags vs derived indicators**: Tags (e.g. UDE) are user-authored and stored. Derived indicators (e.g. Root Cause) are computed from graph topology at render time — never persisted.
- **React Flow sync**: Store is source of truth for data. Local state (`localNodes`/`localEdges`) is needed for RF selection. `useEffect` on `rfNodes`/`rfEdges` merges store data into local state, preserving selection.
- **Undo/redo boundaries**: Drag commits on pointer-up, text on blur/Enter, import/delete/layout are atomic.
- **Junction logic**: `junctionType` on nodes is only relevant when indegree >= 2. Current behavior defaults new 2-input nodes to `or`.
- **File format**: `.sky` is the canonical explicit save format. Loader also accepts legacy wrapped `.sky` and raw diagram JSON for backwards compatibility.
- **Autosave model**: Diagram autosave uses `sessionStorage`; settings use `localStorage`.
- **AI workflow**: The chat store streams text and can batch-apply node/edge mutations, then auto-layout the updated diagram.
- **Layout boundary**: `autoLayout()` selects between a tree engine and a cyclic engine based on actual graph topology. Changes to loop readability should stay inside `src/core/layout` unless there is a deliberate product decision to change routing behavior.
