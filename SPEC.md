# Sketchy — Thinking Frameworks Diagram Editor

## Overview

A web-based editor for building structured thinking diagrams. Supports multiple thinking frameworks — each framework defines its own node categories, edge semantics, junction logic, and layout defaults.

The first framework is **Current Reality Tree (CRT)** from the Theory of Constraints. The architecture supports adding more frameworks without changing the core diagram engine.

Inspired by Flying Logic's approach to sufficiency-based logic diagrams.

## Architecture: Core + Frameworks

### Core (framework-agnostic)

The diagram engine handles all generic diagramming concerns:

- Canvas: pan, zoom, minimap, grid
- Nodes: create, edit text, drag, select, delete
- Edges: connect, route, delete
- Junctions: AND/OR logic on incoming edges (optional per framework)
- Auto-layout (dagre) with configurable direction
- Undo/redo
- Persistence (localStorage, JSON export/import)
- Context menus, toolbar, properties panel

### Framework Definition

Each framework is a configuration object that tells the core engine what to render:

```typescript
interface Framework {
  id: string;
  name: string;                    // e.g. "Current Reality Tree"
  description: string;
  defaultLayoutDirection: 'TB' | 'BT';
  supportsJunctions: boolean;      // whether AND/OR logic applies
  nodeTags: NodeTag[];             // user-assignable tags (e.g. UDE)
  derivedIndicators: DerivedIndicator[]; // computed from graph structure
  edgeLabel?: string;              // e.g. "causes", "leads to", "necessary for"
}

interface NodeTag {
  id: string;
  name: string;                    // e.g. "Undesirable Effect"
  shortName: string;               // e.g. "UDE"
  color: string;                   // left-border accent color
  description: string;
  exclusive: boolean;              // if true, only one tag from this framework can be active per node
}

// Indicators derived from graph topology — not user-editable
interface DerivedIndicator {
  id: string;
  name: string;                    // e.g. "Root Cause"
  shortName: string;               // e.g. "Root"
  color: string;                   // visual accent when this condition is met
  condition: 'indegree-zero' | 'leaf' | 'indegree-and-outdegree'; // how to detect
  description: string;
}
```

### CRT Framework (v1)

```typescript
const crtFramework: Framework = {
  id: 'crt',
  name: 'Current Reality Tree',
  description: 'Map cause-and-effect to find root causes of undesirable effects',
  defaultLayoutDirection: 'TB',
  supportsJunctions: true,
  edgeLabel: 'causes',
  nodeTags: [
    { id: 'ude', name: 'Undesirable Effect', shortName: 'UDE', color: '#E57373',
      description: 'Something you want to eliminate', exclusive: false },
  ],
  derivedIndicators: [
    { id: 'root-cause',   name: 'Root Cause',         shortName: 'Root',  color: '#5C8DB5',
      condition: 'indegree-zero', description: 'No incoming edges — a fundamental driver' },
    { id: 'intermediate', name: 'Intermediate Effect', shortName: 'Inter', color: '#9E9E9E',
      condition: 'indegree-and-outdegree', description: 'Has both incoming and outgoing edges' },
  ],
};
```

**Key distinction**: `nodeTags` are user-authored (the user explicitly marks a node as a UDE). `derivedIndicators` are computed from the graph — a node is a "root cause" because it has no incoming edges, not because the user labeled it. The UI displays both, but only tags are editable.

### Future Frameworks (examples, not in v1 scope)

- **Future Reality Tree (FRT)** — desired effects, injections, positive reinforcing loops
- **Evaporating Cloud (EC)** — conflict resolution: objective, requirements, prerequisites
- **Prerequisite Tree (PRT)** — obstacles and intermediate objectives
- **Strategy & Tactics Tree** — hierarchical strategy decomposition
- **Generic Causal Loop** — freeform cause-and-effect without TOC constraints

## v1 Features

### Framework Selector

- Dropdown or selector in the header to choose the active framework
- v1 ships with CRT only, but the selector is present and the architecture supports additions
- Switching framework on an existing diagram prompts a warning (categories may not map)

### Canvas

- Infinite pannable, zoomable canvas
- Minimap for orientation
- Grid background (toggleable)

### Nodes

- Create by double-clicking canvas or via toolbar
- Inline text editing (click to edit)
- Drag to reposition
- Multi-select (shift+click or marquee)
- Delete selected (Delete/Backspace key)
- **Tags** (user-authored): assigned via the side panel (primary) or right-click context menu (shortcut). Tags come from the active framework (e.g. UDE in CRT).
- **Derived indicators** (computed): displayed automatically based on graph structure (e.g. root cause = no incoming edges). Not editable — they update as edges change.
- Visual: left-border accent color from the highest-priority active tag or derived indicator
- Fixed width (240px), height grows with text content, minimum height 48px

### Edges (Connections)

- Create by dragging from a source handle to a target handle
- Directed arrows
- Deletable (select + Delete)
- Smoothstep or bezier routing

### Graph Validity (v1)

The engine enforces a valid DAG at all times:

- **No self-loops**: An edge from a node to itself is rejected on create
- **No duplicate edges**: Only one edge between the same source→target pair
- **No cycles**: When a new edge would create a cycle, the edge is rejected and the user sees a brief toast ("Cannot connect: would create a cycle")
- **Import validation**: Imported JSON is validated for all of the above; invalid edges are dropped with a summary warning

### Junctions (when framework.supportsJunctions is true)

- When multiple edges arrive at the same node, user can toggle between AND and OR
- **AND**: A visual bar/arc groups the incoming edges
- **OR**: Edges arrive independently
- Toggle via the side panel (primary) or right-click context menu (shortcut)
- **Indegree rules**: Junction type is hidden and irrelevant when a node has 0 or 1 incoming edges. When the second incoming edge is added, the junction defaults to AND. The junction indicator disappears if edges are removed back below 2.

### Layout

- **Direction**: Default from framework, overridable in settings. In BT mode, source handles move to the top and target handles to the bottom (flipped from TB).
- **Auto-layout**: Button to arrange the tree using dagre. Also triggered automatically on framework switch.
- **Manual override**: After auto-layout, nodes are freely draggable without being auto-pinned. Nodes are only treated as "pinned" when the user explicitly pins them, and subsequent auto-layout repositions only unpinned nodes. A "re-layout all" option clears all pins.
- **Relayout triggers**: Auto-layout is NOT automatically re-run when text changes size or edges are added (this would fight manual positioning). The user explicitly triggers it.
- **Setting**: Layout direction (TB or BT) stored in preferences

### Persistence (v1)

- **Auto-save**: Debounced to localStorage (500ms after last change). Saves the full diagram state.
- **Schema version**: All persisted data includes a `schemaVersion: number` field (starting at 1). On load, the app checks the version and runs migrations if needed.
- **Export**: Download diagram as `.json` file. Includes `schemaVersion`, `frameworkId`, and all nodes/edges.
- **Import**: Load diagram from `.json` file. Validates:
  - `schemaVersion` is present and supported (migrates if older)
  - `frameworkId` matches a known framework (warns if unknown, offers to load as generic)
  - Graph validity (drops invalid edges with summary warning — see Graph Validity)
  - Required fields present on all nodes/edges
- **Corrupted localStorage recovery**: If localStorage data fails to parse or validate, the app starts with an empty diagram and shows a warning toast ("Saved data was corrupted and could not be loaded"). The corrupted data is preserved under a `sketchy_backup_<timestamp>` key for manual recovery.
- **New / clear diagram**: Creates a fresh empty diagram. Prompts confirmation if current diagram has unsaved changes (i.e. changes since last export — localStorage auto-save does not count as "saved").

### Toolbar / UI

- Top toolbar:
  - Framework selector
  - New diagram
  - Auto-layout button
  - Export JSON / Import JSON
  - Undo / Redo
- Side panel (primary edit surface):
  - Node properties (when selected): text, tags (from framework), derived indicators (read-only display)
  - Junction type (when node with 2+ incoming edges selected, if framework supports junctions)
  - Diagram settings (layout direction, grid toggle)
- Right-click context menu (shortcut, not primary):
  - Quick tag assignment
  - Quick junction toggle
  - Delete

### Undo/Redo

- Full undo/redo stack for all operations (add, delete, move, edit, connect)
- **Operation boundaries**:
  - **Drag**: Commits as a single undo step on pointer-up (the entire drag, not each pixel)
  - **Text edit**: Commits on blur or Enter (the entire edit session, not each keystroke)
  - **Import / New diagram**: Single atomic action
  - **Multi-select delete**: Single atomic action (all deleted nodes/edges restored together on undo)
  - **Auto-layout**: Single atomic action (all position changes reverted together on undo)

## v2 Backlog (TODO)

- [ ] Advanced logic validation (warn about orphan nodes, incomplete AND junctions beyond basic cycle/dupe checks)
- [ ] Confidence/weight annotations on edges (-1 to +1 scale)
- [ ] Backend persistence with user accounts
- [ ] Real-time collaboration (multiple users editing same tree)
- [ ] Export to PNG / SVG / PDF
- [ ] Additional frameworks: FRT, Evaporating Cloud, PRT, Strategy & Tactics, Generic Causal Loop
- [ ] Keyboard shortcuts panel
- [ ] Node grouping / swim lanes
- [ ] Search / filter nodes by text or category
- [ ] Templates / example diagrams per framework

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | React + TypeScript | Strong ecosystem, typing for complex state |
| Build | Vite | Fast dev server, simple config |
| Diagram engine | React Flow (@xyflow/react) | Purpose-built for node/edge editors — handles pan, zoom, drag, connections, minimap out of the box |
| Auto-layout | dagre | Lightweight DAG layout algorithm, well-tested with React Flow |
| State management | Zustand | Lightweight, works well with React Flow's store pattern |
| Styling | Tailwind CSS | Utility-first, fast iteration |
| Rendering | Hybrid DOM + SVG | DOM for nodes (rich content, easy styling), SVG for edges (React Flow default) |

## Data Model

```typescript
interface Diagram {
  schemaVersion: number;           // starts at 1, incremented on breaking changes
  id: string;
  name: string;
  frameworkId: string;             // e.g. 'crt'
  settings: DiagramSettings;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

interface DiagramSettings {
  layoutDirection: 'TB' | 'BT';
  showGrid: boolean;
}

interface DiagramNode {
  id: string;
  type: 'entity';
  position: { x: number; y: number };
  pinned: boolean;                 // if true, auto-layout skips this node
  data: {
    label: string;
    tags: string[];                // user-authored tags, e.g. ['ude'] — references NodeTag.id
    junctionType: 'and' | 'or';   // how multiple incoming edges are interpreted
  };
}

// Derived properties (NOT persisted — computed at render time from graph structure):
//   - isRootCause: indegree === 0
//   - isLeaf: outdegree === 0
//   - isIntermediate: indegree > 0 && outdegree > 0
//   - effectiveJunction: junctionType is only relevant when indegree >= 2

interface DiagramEdge {
  id: string;
  source: string;
  target: string;
}
```

## Key Interactions

1. **Select framework**: Choose from dropdown in header → canvas adapts available tags and options
2. **Create node**: Double-click canvas → new node appears at cursor → immediately editable
3. **Connect**: Drag from source handle → drop on target handle → edge created (rejected with toast if it would create a self-loop, duplicate, or cycle)
4. **Tag a node**: Select node → use side panel to toggle tags (e.g. mark as UDE). Right-click menu as shortcut.
5. **Toggle junction**: Select node with 2+ incoming edges → use side panel or right-click → AND / OR toggle
6. **Auto-layout**: Click layout button → dagre computes positions → unpinned nodes animate to new positions
7. **Export**: Click export → browser downloads `.json` file (includes schemaVersion + frameworkId)
8. **Import**: Click import → file picker → validates schema, framework, and graph → diagram loads (invalid edges dropped with warning)

## Visual Design Direction

Follows the Bricky design system for consistency across projects.

### Typography
- **Body font**: "DM Sans" (variable, weights 100–1000, optical sizing 9–40px)
- **Display font**: "Playfair Display" (serif, for app title / branding)
- Loaded from Google Fonts

### Typography Scale
- App title: 1.5rem, weight 600, Playfair Display
- Panel title: 1.125rem, weight 650
- Section heading: 0.875rem, weight 600
- Field label: 0.75rem
- Section label: 0.7rem, uppercase, letter-spacing 0.12em

### Color Palette (CSS custom properties)
- `--app-bg-top`: #F5F5EC (warm off-white)
- `--app-bg-bottom`: #EBE9E0 (slightly darker gradient)
- `--surface`: rgba(255,255,255,0.96) (panel/card backgrounds)
- `--surface-muted`: #F5F5EC
- `--border`: #E0DDD4
- `--border-strong`: #D4D0C6
- `--text`: #212121
- `--text-muted`: #6B6B6B
- `--text-soft`: #8A8A7A
- `--accent`: #212121 (primary action color — dark)
- `--accent-hover`: #3a3a3a
- `--accent-shadow`: rgba(33,33,33,0.18)
- `--secondary`: #E8E4DA
- `--secondary-hover`: #DDD8CC
- `--shadow`: 0 20px 45px rgba(33,33,33,0.06)

### Node Visual Priority (how accent color is chosen)
Nodes display a 4px left-border accent. Priority order:
1. **User-authored tag** (highest): e.g. UDE → #E57373 coral/red
2. **Derived indicator**: e.g. Root Cause (indegree=0) → #5C8DB5 blue
3. **Default** (no tag, no indicator match): neutral — uses `--border`

### Component Patterns
- **Buttons**: Fully rounded (border-radius 9999px), uppercase, 0.8rem, weight 600, letter-spacing 0.06em
  - Primary: dark bg (#212121), white text, shadow
  - Secondary: light bg (--secondary), dark text
  - Icon buttons: 2.25rem square
  - XS variant: smaller padding, 0.7rem font
- **Panels**: rounded corners (1.25rem), surface bg, 1px border, soft shadow, 1.5rem padding
- **Inputs**: fully rounded, 1px border, small font (0.75rem), tabular-nums for numbers
- **Header**: flex row, backdrop-filter blur(14px), border-bottom

### Visual Characteristics
- Clean, minimal UI — the tree is the focus
- Warm neutral palette (beiges, grays, blacks)
- Rounded corners everywhere (buttons fully round, panels 1.25rem)
- Soft elevation via subtle shadows
- Semi-transparent surfaces with backdrop blur
- Transitions: 0.2s ease on all interactive elements
- Hover: slight elevation (translateY(-1px)), lighter shadow
- Focus: 2px outline, accent color, 2px offset

### Icons
- **Lucide React** — SVG-based, 16px default, inherits color from parent

### Entity Node Styling
- Rounded rectangles with subtle shadow
- 4px left border in category color
- White/surface background
- AND junction: horizontal bar/arc connecting grouped incoming edges
- Connection handles: small circles at top/bottom edges

### Layout
- Light mode only (v1)
- Canvas takes full viewport below header
- Settings panel overlays or docks to the side
- Responsive: stack panels on smaller screens
