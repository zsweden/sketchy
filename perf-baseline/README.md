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
node /tmp/aggregate-perf.mjs  # writes perf-baseline/baseline.json
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

## Headline numbers (2026-04-19, post-debounce)

| Benchmark | Median |
|---|---|
| `edge-routing-100-dense` (raw compute) | **4896 ms** — the algorithm is still the algorithm |
| `edge-routing-127-tree` (raw compute) | 1547 ms |
| `edge-routing-50-chain` (raw compute) | 222 ms |
| `drag-20-frames-50-chain-uncached` | **4550 ms** — avoided by the debounced hook |
| `layout-100-dense` | 142 ms |
| `layout-500-chain` | 59 ms |
| `autosave-subscribe-fires-per-50-mixed-mutations` | 50 (fires on every setState) |
| `selector-node-ref-invalidations-per-2-unrelated-mutations` | **0** (store refs are stable) |
| `drag-500-frames-100-nodes` (store cost only) | 4 ms |

## What this tells us

- **Edge routing algorithm itself is unchanged** — 4.9 s for a 100-edge dense graph. The `edge-routing-*` benches measure the raw `getOptimizedEdgePlacements` call; those numbers track the algorithm's cost and won't move until the algorithm is optimized.
- **Drag no longer pays that cost per frame** — `useDebouncedEdgePlacements` (see `src/hooks/useDebouncedEdgePlacements.ts`) defers recomputes for 120 ms after inputs settle. 20 drag frames on a 50-chain would otherwise cost ~4.5 s (`drag-20-frames-50-chain-uncached`); with debouncing, at most one recompute fires after the drag ends.
- **Zustand selectors are NOT the problem** — `s.diagram.nodes` keeps the same ref across unrelated mutations, so the earlier hypothesis was wrong.
- **Autosave subscribes to every setState** — 50/50 fires. Not a hot path given serialize is sub-millisecond, but still wasteful. Fix is cheap (selector-aware subscribe).

## History

- `baseline.json` — current baseline
- `baseline-before-debounce.json` — pre-`useDebouncedEdgePlacements` snapshot (2026-04-19), kept for reference

## Compare a new run

```bash
# Capture new timings with the same script, write to baseline-new.json
# Then diff:
diff <(jq -S '.benchmarks | to_entries | map({key, median: .value.median})' perf-baseline/baseline.json) \
     <(jq -S '.benchmarks | to_entries | map({key, median: .value.median})' perf-baseline/baseline-new.json)
```
