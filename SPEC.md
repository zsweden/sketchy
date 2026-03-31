# Sketchy Spec

## Product Definition

Sketchy is a focused editor for structured thinking diagrams. It is not intended to become a general-purpose diagramming tool. The product value comes from combining:

- framework-aware semantics
- constrained graph validity
- fast editing and auto-layout
- AI assistance that understands the current diagram state

The current product center is Theory of Constraints style reasoning.

## Current State

Sketchy currently supports these frameworks:

- `CRT` — Current Reality Tree
- `FRT` — Future Reality Tree
- `Goal Tree`
- `PRT` — Prerequisite Tree
- `Success Tree`
- `STT` — Strategy & Tactics Tree
- `CLD` — Causal Loop Diagram

The public docs and product planning should treat Sketchy as a multi-framework app now, not a CRT-only prototype.

## Product Principles

- Keep the core editor framework-agnostic
- Add framework value through configuration first, not framework-specific branches in core code
- Prefer diagram types that fit the current DAG-based engine
- Avoid broadening into generic UML/whiteboard territory unless the core model is intentionally expanded

## Core Engine Constraints

The current engine is optimized for directed acyclic reasoning diagrams.

- One base node shape
- Directed edges
- No self-loops
- No duplicate edges
- No cycles
- Optional AND/OR junction semantics on incoming edges
- Framework-defined tags and derived indicators

These constraints make some diagram types cheap to add and others fundamentally expensive.

## Supported Frameworks

### Current Reality Tree

Purpose:
Trace undesirable effects back to root causes.

Current semantics:

- Edge label: `causes`
- Tags: `Undesirable Effect`
- Derived indicators: `Root Cause`, `Intermediate Effect`

### Future Reality Tree

Purpose:
Validate whether proposed injections lead to desirable effects.

Current semantics:

- Edge label: `leads to`
- Tags: `Injection`, `Desirable Effect`
- Derived indicators: `Foundation`, `Intermediate Effect`

### Prerequisite Tree

Purpose:
Map obstacles and intermediate objectives needed to reach a goal.

Current semantics:

- Edge label: `enables`
- Tags: `Obstacle`, `Intermediate Objective`, `Goal`
- Derived indicators: `Starting Point`, `Milestone`, `Target Outcome`

### Goal Tree

Purpose:
Break a goal into the supporting conditions, sub-goals, and actions required to achieve it.

Current semantics:

- Edge label: `supports`
- Tags: `Goal`, `Necessary Condition`, `Action`
- Derived indicators: `Foundation`, `Bridge`, `Target Goal`

### Strategy & Tactics Tree

Purpose:
Break an objective into strategy, tactics, and supporting execution points.

Current semantics:

- Edge label: `is achieved through`
- Tags: `Objective`, `Strategy`, `Tactic`
- Derived indicators: `Top-Level Aim`, `Bridge`, `Execution Point`

### Success Tree

Purpose:
Explain how multiple contributing factors led to a successful outcome.

Current semantics:

- Edge label: `contributed to`
- Tags: `Success Factor`, `Achievement`
- Derived indicators: `Foundation`, `Contributor`, `Outcome`

## Current Feature Set

### Editing

- Create nodes on the canvas
- Edit node text and notes
- Connect nodes with directed edges
- Edit edge confidence and notes
- Multi-select and delete
- Undo/redo
- Right-click context menus

### Framework-Aware Behavior

- Framework selector in the toolbar
- Framework-specific node tags
- Derived indicators computed from graph topology
- Junction logic for nodes with multiple incoming edges

### Layout

- Auto-layout with ELK as the primary engine
- Layout direction toggle (`TB` / `BT`)
- Fit-view requests after important actions

### Persistence

- Autosave to `sessionStorage`
- Explicit save/load through `.sky` files
- Schema migration on load
- Import sanitization for invalid edges

### AI Assistance

- Side-panel chat tied to the active diagram
- Configurable API key, model, and base URL
- OpenAI-compatible endpoint support
- Batched AI modifications to nodes and edges
- Automatic re-layout after AI-applied changes

## Current UI Surfaces

### Toolbar

- Framework selector
- New diagram
- Select and pan tools
- Auto-layout
- Undo/redo
- Load / Save / Print
- Settings popover
- Side-panel toggle

Notes:

- `Print` is present in the UI but still a placeholder action

### Side Panel

- Node inspector
- Edge inspector
- Diagram settings
- AI chat

## Persistence Model

### Session Autosave

- Diagram state is stored in `sessionStorage`
- Corrupted session data is backed up to `localStorage` under `sketchy_backup_<timestamp>`

### Saved Projects

- Primary explicit file format is `.sky`
- Legacy wrapped `.sky` and raw diagram JSON are still accepted on load
- Unknown frameworks can still load with a warning

## Data Model Snapshot

```typescript
interface Diagram {
  schemaVersion: number;
  id: string;
  name: string;
  frameworkId: string;
  settings: {
    layoutDirection: 'TB' | 'BT';
    showGrid: boolean;
  };
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

interface DiagramNode {
  id: string;
  type: 'entity';
  position: { x: number; y: number };
  data: {
    label: string;
    tags: string[];
    junctionType: 'and' | 'or';
    notes?: string;
    color?: string;
  };
}

interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  confidence?: 'high' | 'medium' | 'low';
  notes?: string;
}
```

## Framework Roadmap

These are the most promising additions given the current architecture.

### Tier 1: Add Next

#### Evaporating Cloud (EC)

Why:

- high value per diagram
- expands Sketchy into conflict resolution, not just causal analysis
- strategically important if Sketchy should become the place for TOC thinking tools

Risk:

- likely needs stronger role semantics than the current node-tag model alone

### Tier 2: Strong Candidates

#### Transition Tree

Why:

- useful for implementation sequencing and rollout logic
- aligned with the same audience as CRT/FRT/PRT

## Frameworks To Defer

### Generic Causal Loop Diagrams

Defer because:

- true value depends on feedback loops
- the current validator rejects cycles by design
- adding this is a core model change, not just a new framework

### UML / Sequence / Class / ERD

Defer because:

- these push Sketchy toward generic diagramming
- they need different primitives, layouts, and editing affordances
- they dilute the product thesis

## Implementation Guidance For New Frameworks

Add a new framework when it can mostly be expressed through:

- `name`
- `description`
- `defaultLayoutDirection`
- `supportsJunctions`
- `edgeLabel`
- framework tags
- derived indicators

Expect larger core changes when a candidate requires:

- cycles
- multiple node shapes with structural meaning
- non-DAG validation
- framework-specific edge types beyond simple directed relations
- rigid role-based templates

## Near-Term Documentation / Product Cleanup

- Keep docs aligned with the actual supported frameworks
- Stop referring to Sketchy as CRT-only
- Treat `.sky` as the canonical explicit save format
- Treat ELK as the default auto-layout engine in docs
- Document the current AI chat and settings workflow as first-class functionality
