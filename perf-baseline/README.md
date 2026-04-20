# Perf baseline

`baseline.json` is a reference snapshot of `npm run test:perf`, captured by averaging 5 sequential runs. Use it as the "before" number when evaluating perf-related changes.

## Capture

```bash
for i in 1 2 3 4 5; do
  RUN_PERF_TESTS=1 npx vitest run \
    src/__tests__/perf-benchmark.test.ts \
    src/core/layout/__tests__/cld-layout-metrics.test.ts \
    --reporter=verbose 2>&1 | grep -E '^\[perf\]' > /tmp/perf-run-$i.txt
done
npm run perf:aggregate  # writes perf-baseline/baseline.json
```

Each entry records `samples` (5 values), `min`, `median`, `mean`, `max`. Use `median` as the headline.

## What's in it

- **Layout** (ELK): chain / tree / dense / cyclic
- **Derived indicators**: degrees, per-node indicators
- **Cycle detection**: 20/50/100-node graphs with cycles
- **Autosave**: JSON serialize + round-trip
- **File load**: validate + migrate
- **Store mutations**: batchApply, delete, move, undo
- **Selector stability** (new): counts how many unrelated mutations invalidate `diagram.nodes` / `diagram.edges` refs
- **Autosave subscription** (new): counts how many times a whole-store subscribe callback fires across mixed mutations
- **Edge routing** (new): `computeEdgeRoutingPlacements` on 50-chain / 127-tree / 100-dense

## Headline numbers (2026-04-19, post-R-tree refactor)

| Benchmark | Median | Change vs pre-refactor |
|---|---|---|
| `edge-routing-100-dense` | **454 ms** | **−91 %** (from 4920 ms) |
| `edge-routing-127-tree` | **61 ms** | **−96 %** (from 1560 ms) |
| `edge-routing-50-chain` | **17 ms** | **−93 %** (from 232 ms) |
| `drag-20-frames-50-chain-uncached` | **333 ms** | **−93 %** (from 4550 ms) |
| `layout-100-dense` | 139 ms | unchanged |
| `layout-500-chain` | 59 ms | unchanged |
| `autosave-subscribe-fires-per-50-mixed-mutations` | 50 | unchanged (fires on every setState) |
| `selector-node-ref-invalidations-per-2-unrelated-mutations` | 0 | unchanged (store refs are stable) |
| `drag-500-frames-100-nodes` (store cost only) | 4 ms | unchanged |

## What this tells us

- **Edge routing was O(E²); now it's ~O(E log E).** `src/core/edge-routing/edge-optimization-algorithm.ts` uses an `rbush` R-tree over both node boxes and edge geometries, replacing the two inner linear scans with spatial lookups. Placements are bitwise-identical to the previous algorithm (verified by `placement-consistency.test.ts`).
- **Two compounding wins on drag.** `useDebouncedEdgePlacements` still collapses rapid drag frames into a single recompute after 120 ms, and that recompute is now ~11× cheaper.
- **Zustand selectors are NOT the problem.** `s.diagram.nodes` keeps the same ref across unrelated mutations.
- **Autosave subscribes to every setState** — 50 fires per 50 mixed mutations. Still wasteful but cheap (serialize is sub-millisecond); low priority.

## History

- `baseline.json` — current baseline (post-R-tree)
- `baseline-before-debounce.json` — pre-`useDebouncedEdgePlacements`, pre-R-tree snapshot (2026-04-19)

## Compare a new run

```bash
# Capture new timings with the same script, write to baseline-new.json
# Then diff:
diff <(jq -S '.benchmarks | to_entries | map({key, median: .value.median})' perf-baseline/baseline.json) \
     <(jq -S '.benchmarks | to_entries | map({key, median: .value.median})' perf-baseline/baseline-new.json)
```
