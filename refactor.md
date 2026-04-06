# Refactor Plan

LOC reduction opportunities, ranked by impact-to-complexity ratio. Updated 2026-04-06.

| # | Target | LOC Now | Est. Reduction | Complexity | Status |
|---|--------|---------|----------------|------------|--------|
| 1 | themes.ts | 343 | 100–140 | Low | Done (343 → 62 + JSON data) |
| 2 | ContextMenu.tsx | 490 | 80–120 | Medium | Done (490 → 437, extracted ColorSwatchRow) |
| 3 | e2e/app.spec.ts | 1,584 | 200–280 | High | Done (split into 6 spec files + helpers) |
| 4 | Legacy .sky support | 219 | 30–50 | Low | Done (dropped legacy formats, isUDE shims) |
| 5 | chat-store.ts | 466 | 148 | Medium | Done (466 → 319, extracted chat-stream-handlers.ts) |
| 6 | system-prompt.ts | 349 | 180 | Medium | Done (349 → 169, extracted tools.ts) |
| 7 | DiagramCanvas.tsx | 366 | 189 | High | Done (366 → 177, extracted useCanvasHandlers.ts) |
| 8 | Test fixtures | 1,397 | 81 | High | Done (extracted shared fixtures to src/test/fixtures.ts) |

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

## 5. chat-store.ts — Done

Extracted `processStreamDone`, `reportStreamError`, `createAssistantMessage`, and error-metadata builders into `chat-stream-handlers.ts`. chat-store.ts slimmed from 466 to 319 lines.

## 6. system-prompt.ts — Done

Extracted `modifyDiagramTool`, `suggestFrameworksTool` + Anthropic aliases into `tools.ts` (187 lines). system-prompt.ts slimmed from 349 to 169 lines. Re-exports preserved for backward compatibility.

## 7. DiagramCanvas.tsx — Done

Extracted all React Flow event handlers (onNodesChange, onEdgesChange, onConnect, onNodeDragStop, selection, context menus, double-click, removal flush) into `useCanvasHandlers` hook. DiagramCanvas.tsx slimmed from 366 to 177 lines.

## 8. Test fixtures — Done

Extracted mock frameworks (CRT, CLD, FRT), `makeCRTDiagram`, and SSE response helpers into shared `src/test/fixtures.ts`. openai-client.test.ts slimmed from 844 to 763 lines.
