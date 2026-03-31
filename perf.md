# Cyclic Layout Performance Plan

## Current Baseline

Current cyclic perf tests live in [src/__tests__/perf-benchmark.test.ts](/Users/ziadismail/GitHub/sketchy/src/__tests__/perf-benchmark.test.ts).

Latest filtered run:

- Command: `RUN_PERF_TESTS=1 npx vitest run src/__tests__/perf-benchmark.test.ts -t '8-node cyclic graph|12-node cyclic graph' --reporter=verbose`
- 8-node cyclic test: passed, Vitest duration `1503ms`
- 12-node cyclic test: passed, Vitest duration `2563ms`

Note: Vitest's displayed per-test duration includes setup and the benchmark helper's warm-up run. The test assertions themselves use the internal measured `t` value.

## Primary Findings

1. The cyclic engine can perform multiple ELK layouts for a single request.
   It runs a direct cyclic ELK layout first, may also run a condensed layout, and may run one additional cyclic ELK layout per SCC template.

2. Candidate scoring is too expensive.
   Each SCC optimization tries multiple seed variants and symmetry variants, then scores each candidate by rebuilding whole-graph positions and recomputing full graph metrics.

3. Edge repulsion is inside the hottest loop.
   Force relaxation runs many iterations, and each iteration recomputes routed edge geometries for obstacle edges.

4. Edge routing itself does repeated quadratic work.
   The routing metric code rebuilds candidate polylines and compares them against other edges repeatedly.

5. Some graph analysis work is duplicated.
   SCC detection happens in `autoLayout()` and again inside the cyclic engine.

## Plan

### Phase 1: Remove avoidable whole-graph rescoring

- Change SCC candidate scoring so it evaluates only the active SCC and its boundary edges, not the entire graph.
- Precompute static context outside the candidate loop:
  - node lookup
  - non-component positions
  - relevant edge subset
  - component membership sets
- Avoid rebuilding a full `candidatePositions` map for every candidate when only a small SCC moved.

Expected effect:

- Largest CPU reduction in the custom optimization stage.
- Better scaling as total graph size grows while SCC size stays moderate.

### Phase 2: Throttle edge repulsion during force relaxation

- Do not call `applyEdgeRepulsion()` on every iteration.
- Run it only:
  - every 4th or 8th iteration, or
  - only during the final refinement window, or
  - adaptively when overlap/crossing pressure remains high.
- Keep the current overlap resolution pass so node separation remains stable.

Expected effect:

- Significant reduction in repeated geometry recomputation.
- Low implementation risk relative to deeper algorithm changes.

### Phase 3: Reduce ELK invocations

- Make condensed layout conditional instead of automatic.
- Start from the direct cyclic ELK result and only try condensed layout when a cheap quality heuristic says the direct result is poor.
- Avoid building SCC templates through extra ELK calls unless the component actually benefits from template expansion.

Possible heuristic triggers:

- node overlap present
- excessive edge-node overlap
- high crossing count
- more than one cyclic SCC with strong cross-component connectivity

Expected effect:

- Fewer expensive external layout passes.
- Lower latency on small and medium cyclic graphs.

### Phase 4: Cache routed edge geometry work

- Refactor `computeRoutedEdgeGeometries()` so it reuses:
  - candidate polylines per edge placement
  - current chosen geometry for each other edge
- Avoid rebuilding the same "other edge" geometry inside inner scoring loops.
- If needed, introduce a small geometry cache keyed by:
  - edge id/index
  - placement
  - node box snapshot or a stable version marker

Expected effect:

- Lower constant factors in both metric computation and edge repulsion.
- Better performance on dense cyclic graphs.

### Phase 5: Remove duplicated setup work

- Compute SCCs once and pass them from `autoLayout()` into the cyclic engine.
- Replace repeated linear lookups such as `nodes.find(...)` with maps in hot or semi-hot paths.
- Keep these changes small and mechanical.

Expected effect:

- Small but clean baseline improvement.
- Simplifies future profiling because the call graph becomes easier to reason about.

## Suggested Implementation Order

1. Localize and cache SCC scoring.
2. Throttle `applyEdgeRepulsion()`.
3. Make condensed layout conditional.
4. Cache routed edge geometry work.
5. Clean up duplicate SCC and lookup overhead.

## Validation

After each phase:

- Run the filtered cyclic perf tests.
- Run `npm run test:perf`.
- Recheck layout-quality guardrails in `src/core/layout/__tests__/cld-layout-metrics.test.ts`.
- Spot-check deterministic behavior with the layout stability tests.

## Success Criteria

- Reduce cyclic benchmark latency materially without regressing layout quality.
- Preserve deterministic output for repeated runs on the same graph.
- Keep CLD metric guardrails passing.
- Avoid changes outside `src/core/layout/` unless profiling proves a boundary issue.
