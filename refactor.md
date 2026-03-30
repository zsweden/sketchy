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
Extract custom hooks: `useCanvasHighlighting`, `useRFStateSync`, `useCanvasHandlers`.
- **Impact**: Testable units, cleaner component
- **Effort**: 1-2 hours

### 5. Split diagram-store (771 lines)
Separate node ops, edge ops, batch ops into slice files.
- **Impact**: Most impactful for long-term maintainability
- **Effort**: 2-3 hours

### 6. Extract LoopCard component
Identical loop display pattern in NodePanel and SettingsPanel.
- **Impact**: Single source of truth for loop UI
- **Effort**: 20 min

## Architecture Notes

- **Store coupling**: Toolbar imports 4 stores — acceptable but would benefit from a `useToolbarState()` hook
- **CSS inline styles**: 15+ `style={{ gap: '0.375rem' }}` could become CSS classes
- **No circular imports** detected — import structure is healthy
- **Prop drilling is minimal** — store-first pattern is working well
