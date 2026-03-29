# Sketchy

Sketchy is a browser-based editor for structured thinking diagrams. It is designed around Theory of Constraints style cause-and-effect work rather than generic whiteboarding.

Today the app supports:

- Current Reality Tree (CRT)
- Future Reality Tree (FRT)
- Prerequisite Tree (PRT)
- Strategy & Tactics Tree (STT)
- AI-assisted diagram analysis and modification through a configurable OpenAI-compatible endpoint
- `.sky` project save/load, plus in-session autosave
- Auto-layout, undo/redo, edge confidence, notes, and framework-specific tags

## Why Sketchy

Sketchy's core model is intentionally narrow:

- Diagrams are directed graphs with framework-specific semantics
- Nodes share a common base shape and are enriched by tags, notes, and derived indicators
- The editor enforces DAG-style validity for current frameworks: no self-loops, no duplicate edges, no cycles

That constraint is a feature. It keeps the product focused on structured reasoning instead of drifting into a generic diagram tool.

## Supported Frameworks

### Current Reality Tree

Use CRT to trace undesirable effects back to root causes.

- Edge semantics: `causes`
- Tags: `Undesirable Effect`
- Derived indicators: `Root Cause`, `Intermediate Effect`

### Future Reality Tree

Use FRT to test whether proposed injections lead to desirable effects.

- Edge semantics: `leads to`
- Tags: `Injection`, `Desirable Effect`
- Derived indicators: `Foundation`, `Intermediate Effect`

## Recommended Next Frameworks

The strongest near-term additions are frameworks that fit the current engine without turning Sketchy into a generic diagrammer.

1. `Evaporating Cloud (EC)`
2. `Transition Tree`

Frameworks to defer for now:

- `Generic Causal Loop Diagrams`: require cycle support, which conflicts with the current validator
- General UML/ERD/sequence diagrams: different product category, weak fit with the current engine

## Tech Stack

- React 19
- TypeScript
- Vite
- React Flow (`@xyflow/react`)
- Zustand
- ELK (`elkjs`) for primary auto-layout
- dagre retained as an alternative/tested layout engine
- Tailwind CSS v4 plus project CSS

## Local Development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run build
npm run lint
npx tsc --noEmit
npx vitest run
```

## Persistence Model

- Session autosave uses `sessionStorage`
- App settings such as API key, model, and base URL use `localStorage`
- Explicit project save/load uses `.sky` files

## AI Integration

Sketchy can analyze and modify the current diagram through the side-panel chat.

- Configure API key, model, and endpoint from the toolbar settings popover
- OpenAI-compatible endpoints are supported
- The assistant can answer questions about the current diagram and apply batched node/edge edits

## Project Status

The app is already beyond the original CRT-only concept. The next product question is not whether Sketchy should support more diagram types in general, but which additional thinking frameworks deepen the existing workflow without breaking its constraints.
