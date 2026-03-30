# Refactor Opportunities

## Quick Wins

### 1. Extract `FormField` component
The `section-stack + section-label` pattern repeats 15+ times across NodePanel, EdgePanel, SettingsPanel.
- **Impact**: Eliminates ~100 lines of duplication
- **Files**: `NodePanel.tsx`, `EdgePanel.tsx`, `SettingsPanel.tsx`, `SettingsPopover.tsx`
- **Status**: Done

### 2. Extract `ButtonGroup` component
Polarity/confidence/junction button rows repeat 8+ times with identical styling logic.
- **Impact**: Eliminates ~80 lines, consistent styling
- **Files**: `EdgePanel.tsx`, `NodePanel.tsx`
- **Status**: Done

### 3. Extract magic numbers to constants
Grid size (20), node defaults (240x48), timeouts (1500, 150), marker size (14) are hardcoded.
- **Impact**: Self-documenting code
- **Files**: `DiagramCanvas.tsx`, `ChatPanel.tsx`, `SettingsPopover.tsx`
- **Status**: Done

## Medium Effort

### 4. Decompose DiagramCanvas (454 lines)
Extract custom hooks: `useCanvasHighlighting`, `useRFNodeEdgeBuilder`.
- **Impact**: Testable units, cleaner component (454 → ~250 lines)
- **Files**: `src/hooks/useCanvasHighlighting.ts`, `src/hooks/useRFNodeEdgeBuilder.ts`
- **Status**: Done

### 5. Split diagram-store (771 lines)
Extract batch ops, edge routing, framework helpers into `diagram-helpers.ts`.
- **Impact**: Store reduced from 771 → 569 lines; 227-line helpers file is independently testable
- **Files**: `src/store/diagram-helpers.ts`
- **Status**: Done

### 6. Extract LoopCard component
Identical loop display pattern in NodePanel and SettingsPanel.
- **Impact**: Single source of truth for loop UI; also fixed remaining hardcoded loop colors in SettingsPanel
- **Files**: `src/components/form/LoopCard.tsx`
- **Status**: Done

## Architecture Notes

- **Store coupling**: Toolbar imports 4 stores — acceptable but would benefit from a `useToolbarState()` hook
- **CSS inline styles**: 15+ `style={{ gap: '0.375rem' }}` could become CSS classes
- **No circular imports** detected — import structure is healthy
- **Prop drilling is minimal** — store-first pattern is working well
