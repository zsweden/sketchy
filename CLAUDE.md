# Sketchy

A web-based thinking frameworks diagram editor. The first framework is Current Reality Tree (CRT) from the Theory of Constraints. The architecture is framework-agnostic — CRT is a config object, not hardcoded.

## Working Principles

### Honesty & Collaboration
- Say if an approach has flaws, will cause bugs, or contradicts existing patterns. Be a collaborator, not a yes-man.
- Stop and re-plan after 2-3 failed attempts. Don't brute-force.

### Testing
- TDD by default — write failing tests before implementation when practical.
- Every bug fix must include a test proving it's fixed and preventing regression.
- Never modify tests to make them pass — investigate the root cause.
- Verify before done: `npx tsc --noEmit && npx vitest run`.

### Architecture
- Core must stay framework-agnostic. All framework-specific logic belongs in `src/frameworks/` config objects, never in core modules. No `frameworkId ===` conditionals in core.
- Keep functions under ~80 lines. Decompose longer ones.
- No compatibility helpers or workarounds — fix the root cause.
- Pause on non-trivial changes (3+ files or architectural decisions) and confirm approach.

### Self-Improvement
- Track rules that would have prevented bugs. After a 2nd occurrence, promote to this CLAUDE.md.

## Commands

```bash
npm run dev          # Start dev server (Vite, http://localhost:5173)
npm run build        # Production build
npx vitest run       # Run all tests
npx tsc --noEmit     # Type check
```

## Tech Stack

- React + TypeScript + Vite
- React Flow (@xyflow/react) — diagram canvas, pan/zoom, node drag, edge connections
- dagre — auto-layout (DAG layout algorithm)
- Zustand — state management (diagram-store, ui-store, tab-store)
- Tailwind CSS v4 (@tailwindcss/vite)
- Lucide React — icons

## Architecture

### Core (framework-agnostic)
- `src/core/types.ts` — Diagram, DiagramNode, DiagramEdge data model
- `src/core/framework-types.ts` — Framework, NodeTag, DerivedIndicator interfaces
- `src/core/graph/validation.ts` — DAG enforcement (no cycles, self-loops, duplicate edges)
- `src/core/graph/derived.ts` — Compute node indicators from graph topology (root cause = indegree 0, etc.)
- `src/core/history/undo-redo.ts` — Generic undo/redo with snapshot stack, exportStacks/importStacks for tabs
- `src/core/layout/dagre-layout.ts` — Auto-layout with pinned node support
- `src/core/persistence/` — localStorage (multi-tab), .sky file save/load, JSON import/export, schema migrations

### Stores (Zustand)
- `src/store/diagram-store.ts` — Active diagram state, CRUD operations, undo/redo. Exports `diagramHistory` for tab swapping.
- `src/store/ui-store.ts` — Selection, context menu, toasts, interaction mode (select/pan), side panel
- `src/store/tab-store.ts` — Multi-tab support, tab switching swaps diagram + history stacks

### Components
- `src/components/canvas/DiagramCanvas.tsx` — React Flow wrapper. Uses local state for RF selection, syncs from store via useEffect. Key: `localNodes`/`localEdges` preserve RF selection while reflecting store data changes.
- `src/components/canvas/EntityNode.tsx` — Custom node: left accent border (tag color > derived color > default), inline editing, badges, junction indicator
- `src/components/toolbar/Toolbar.tsx` — Header: framework selector, new/layout/undo/redo, select/pan toggle, Load/Save/Print buttons
- `src/components/toolbar/TabBar.tsx` — Tab bar below toolbar
- `src/components/panel/` — Side panel: NodePanel (text, tags, junction, derived), SettingsPanel (layout direction, grid)
- `src/components/context-menu/ContextMenu.tsx` — Right-click menu for nodes (tags, junction, delete) and edges (delete)

### Frameworks
- `src/frameworks/crt.ts` — CRT definition: UDE tag, root-cause/intermediate derived indicators
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
- **Junction logic**: `junctionType` on nodes is only relevant when indegree >= 2. Defaults to AND when 2nd edge arrives.
- **File format**: `.sky` wraps diagram in `{ format: "sky", version, createdAt, diagram }`. Also accepts raw diagram JSON for backwards compat.
- **Tab support**: Each tab has its own diagram + undo/redo stacks. `_swapDiagram` swaps both without pushing to history.
