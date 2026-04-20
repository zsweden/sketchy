# Sketchy

A web-based thinking-frameworks diagram editor focused on structured reasoning. Frameworks are auto-discovered from `src/frameworks/*.json` — see that directory for the current list (as of this writing: CLD, CRT, Evaporating Cloud, FRT, Goal Tree, Issue Tree, Org Structure, PRT, STT, Success Tree, Team Topology, Value Stream, VDT).

## Commands

```bash
npm run dev          # Start dev server (Vite, http://localhost:5173)
npm run build        # Production build
npm run lint         # ESLint
npx vitest run       # Run unit tests
npm run test:e2e     # Run Playwright E2E tests
npm run test:all     # Run unit + E2E tests together
npx tsc -b           # Type check (use -b, not --noEmit)
```

### Post-change verification
Run before every commit:
```bash
npm run lint && npx tsc -b && npm run test:all
```

## Tech Stack

- React + TypeScript + Vite
- React Flow (@xyflow/react) — diagram canvas
- ELK (`elkjs`) — auto-layout engine (statically imported)
- Zustand — state management
- Tailwind CSS v4 + project CSS (`src/styles/`)
- Zod — runtime schema validation (framework manifests)
- sonner — toast notifications
- react-hotkeys-hook — keyboard shortcuts
- Lucide React — icons

## Architecture (module map)

```
src/
├── core/                  # Framework-agnostic logic
│   ├── types.ts           # Diagram, DiagramNode, DiagramEdge
│   ├── framework-types.ts # Framework, NodeTag, DerivedIndicator interfaces
│   ├── framework-schema.ts# Zod schema for framework JSON validation
│   ├── ai/                # AI system prompt, streaming, model fetching
│   ├── chat/              # Mention parsing
│   ├── edge-routing/      # Edge placement geometry + optimization
│   ├── graph/             # Validation, derived indicators, ports
│   ├── history/           # Undo/redo snapshot stack
│   ├── layout/            # Auto-layout (tree + cyclic engines via ELK)
│   └── persistence/       # Autosave, .sky/.json file I/O, migrations
├── frameworks/            # JSON manifests + registry (see boundary rules below)
├── store/                 # Zustand stores (diagram, ui, settings, chat, color-history)
├── components/            # React UI (canvas, toolbar, panel, context-menu)
├── hooks/                 # Custom React hooks
├── styles/                # Theme CSS + theme definitions (9 themes)
└── utils/                 # Alignment, distribution, helpers
```

## Rules

### Testing
- Every new feature must ship with tests — no exceptions. Unit tests for logic/state, E2E for user-facing behavior.
- Every bug fix must include a regression test.

### Architecture boundaries
- Core must stay framework-agnostic. No `frameworkId ===` conditionals in core, stores, or components.
- Keep cyclic layout logic isolated to `src/core/layout/`. Loop-specific heuristics must not leak into graph routing, stores, persistence, or UI code.
- Keep functions under ~80 lines. Decompose longer ones.
- No compatibility helpers or workarounds — fix the root cause.

### Framework boundary (enforced)
Adding a framework = drop a `.json` file in `src/frameworks/`. No other file should change.
- **JSON manifests only.** Frameworks are pure data. Never add `.ts` framework files — the registry auto-discovers `*.json` via `import.meta.glob`.
- **Zod-validated at load time.** `src/core/framework-schema.ts` validates every manifest on startup. If you add a field to the `Framework` interface, update the Zod schema to match.
- **No framework imports outside the registry.** Always access frameworks through `getFramework()` / `listFrameworks()` / `getDefaultFramework()` from `src/frameworks/registry.ts`. Never import a specific framework JSON directly.
- **No `frameworkId ===` checks.** All behavior differences flow through `Framework` interface properties (feature flags, tags, derived indicators, junction options). If a new framework needs behavior that existing flags can't express, add a new flag to the interface — don't hardcode a check.
- **AI prompt hints stay with the framework.** Use the `systemPromptHint` field in the JSON manifest for domain-specific AI reasoning guidance. Don't add framework-specific prose to `system-prompt.ts`.

## Key Patterns

- **Tags vs derived indicators**: Tags (e.g. UDE) are user-authored and stored. Derived indicators (e.g. Root Cause) are computed from graph topology at render time — never persisted.
- **React Flow sync**: Store is source of truth. Local state (`localNodes`/`localEdges`) is needed for RF selection. `useEffect` merges store data into local state, preserving selection. Bugs here are subtle — always verify both layers.
- **Undo/redo boundaries**: Drag commits on pointer-up, text on blur/Enter, import/delete/layout are atomic.
- **File format**: `.json` is the canonical save format. Loader also accepts legacy `.sky` wrapped format and raw diagram JSON.
- **Autosave**: Diagram uses `sessionStorage`; settings use `localStorage`.
- **AI workflow**: Chat store streams text, can batch-apply node/edge mutations, then auto-layouts. Guide mode (default on) lets AI recommend framework switches.
- **Design reference**: Shares fonts/colors/button patterns with Bricky (`../Bricky/BrickyReact`). See `src/styles/theme.css` for current values.
