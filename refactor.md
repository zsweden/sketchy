# Refactor Plan

LOC reduction opportunities, ranked by impact-to-complexity ratio. Updated 2026-04-06.

| # | Target | LOC Now | Est. Reduction | Complexity | Status |
|---|--------|---------|----------------|------------|--------|
| 1 | themes.ts | 343 | 100–140 | Low | Done (343 → 62 + JSON data) |
| 2 | ContextMenu.tsx | 490 | 80–120 | Medium | Done (490 → 437, extracted ColorSwatchRow) |
| 3 | e2e/app.spec.ts | 1,584 | 200–280 | High | Done (split into 6 spec files + helpers) |
| 4 | Legacy .sky support | 219 | 30–50 | Low | Done (dropped legacy formats, isUDE shims) |
| 5 | chat-store.ts | 466 | 70–110 | Medium | Not started |
| 6 | system-prompt.ts | 349 | 60–100 | Medium | Not started |
| 7 | DiagramCanvas.tsx | 366 | 90–150 | High | Not started |
| 8 | Test fixtures | 1,397 | 160–250 | High | Not started |

---

## 1. themes.ts — Done

Migrated 9 theme definitions to `themes.json`. Extracted shared loop colors as `LOOP_COLORS` constant. `themes.ts` slimmed from 343 to 62 lines.

## 2. ContextMenu.tsx — Done

Extracted `ColorSwatchRow` component to deduplicate Background and Text Color swatch sections. Removed 53 lines of repeated JSX.

## 3. e2e/app.spec.ts — Done

Split 1,584-line monolith into 6 focused spec files with shared `helpers.ts`:
- `canvas.spec.ts` (13 tests)
- `edges.spec.ts` (7 tests)
- `persistence.spec.ts` (8 tests)
- `frameworks.spec.ts` (10 tests)
- `ui.spec.ts` (10 tests)
- `layout.spec.ts` (6 tests)

## 4. Legacy .sky support — Done

Dropped legacy `.sky` wrapper format and raw diagram JSON loading from `sky-io.ts`. Removed `isUDE` backward-compat shims from `causal-json.ts`. File input now accepts `.json` only.

## 5. chat-store.ts

Extract streaming callback handlers (`onToken`, `onDone`, `onError` ~90 LOC) and error-reporting metadata builders into a separate module. `apply-ai-modifications.ts` already extracted.

## 6. system-prompt.ts

Extract tool definitions (`modifyDiagramTool`, `suggestFrameworksTool` + Anthropic aliases = ~180 LOC) into `tools.ts`. `buildSystemPrompt` and `buildGuideSystemPrompt` share ~60 LOC of rule construction.

## 7. DiagramCanvas.tsx

Extract React Flow event handlers (onConnect, onNodeDragStop, onEdgeClick, etc.) into a `useCanvasHandlers` hook (~100 LOC saved). 3 hooks already extracted but could be consolidated.

## 8. Test fixtures

`openai-client.test.ts` (844 lines) and `diagram-store.test.ts` (553 lines) duplicate mock framework/diagram construction. A shared `src/test/fixtures.ts` would cut across multiple test files.
