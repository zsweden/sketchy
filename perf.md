# Performance Summary

## Scope

This document summarizes the current performance test results from:

- `npm run test:perf`
- `npm run test:perf:engines`
- `npm run test:perf:routing`

The main question was where the biggest opportunities are, including broader workflow paths such as load, save, paste-like batch insert, delete, and history.

## Executive Summary

The app is already fast on load/save/history-style operations. The clear hotspots are:

1. ELK auto-layout on larger or denser graphs
2. Edge routing, especially dense graphs

Everything else measured is materially smaller.

In the full 100-node workflow benchmark, layout is almost the whole cost:

- `workflow-create-100`: `1.13ms`
- `workflow-layout-100`: `14.13ms`
- `workflow-save-100`: `0.07ms`
- `workflow-load-100`: `0.08ms`
- `workflow-derived-100`: `0.04ms`
- `workflow-total-100`: `15.45ms`

## Measured Results

### Auto-layout

- `layout-50-chain`: `21.87ms`
- `layout-100-chain`: `33.01ms`
- `layout-500-chain`: `73.25ms`
- `layout-127-tree`: `20.61ms`
- `layout-100-dense`: `158.3ms`
- `layout-8-cyclic`: `5.47ms`
- `layout-12-cyclic`: `6.57ms`

Interpretation:

- ELK layout is the dominant real user-facing cost.
- Dense graphs are much more expensive than chains or trees.

### Edge routing

- `route-40-chain`: `268.97ms`
- `route-31-tree`: `173.74ms`
- `route-24-dense`: `619.53ms`
- `route-12-cyclic`: `12.12ms`

Interpretation:

- Edge routing is the hottest non-ELK algorithm.
- Dense routing is the standout problem case.
- Current routing is both expensive and still produces weak quality on dense fixtures, so this area has high leverage.

### Broader workflow paths

#### Save / autosave

- `serialize-50`: `0.01ms`
- `serialize-200`: `0.05ms`
- `serialize-500`: `0.12ms`
- `roundtrip-500`: `0.45ms`

#### Load pipeline

- `validate-200`: `0ms`
- `migrate-500`: `0ms`

#### Paste-like batch insert

- `batch-50`: `0.55ms`
- `batch-200`: `4.91ms`

#### Delete

- `delete-100`: `0.01ms`
- `delete-50-of-200`: `0.25ms`

#### History

- `undo-push-50x200`: `13.26ms`
- `undo-restore-500`: `0ms`

#### Move / drag

- `move-1-in-200`: `0.02ms`
- `move-50-in-200`: `0.03ms`

Interpretation:

- Load, save, delete, and move paths are already cheap.
- Batch insert is fine at current sizes.
- History is fine now, but it is the most likely broader-path area to become expensive at much larger diagram sizes because it clones full snapshots.

## Engine Comparison

The engine comparison test is useful for relative positioning, but it is not itself a user-facing latency number because it benchmarks several alternative engines and scores them.

Key result:

- `current-auto` is slower than some alternative engines on raw runtime, but it consistently gives much better quality than the force/stress options.
- The slow alternatives are not good optimization targets unless the product intends to switch engines.

Examples:

- `layout-100-dense`
  - `current-auto`: `155.1ms`, score `1284762`
  - `elk-force`: `685.84ms`, score `278222505`
  - `elk-stress`: `738.75ms`, score `213001674761`
  - `graphology-forceatlas2`: `25.55ms`, score `1038948152`

Conclusion:

- The current ELK-based layout path remains the right baseline.
- The best work is incremental improvement around the current path, not switching to a lower-quality engine.

## Hotspots In Code

### 1. Edge routing candidate scoring

In `src/core/edge-routing/edge-optimization-algorithm.ts`, each edge:

- generates placement candidates
- builds geometry for each candidate
- checks each candidate against every node for edge-node overlap
- checks each candidate against every other edge for crossings
- repeats this for two full passes

That creates repeated `O(edge * candidate * (nodes + edges))` style work with high constant factors.

### 2. Layout metric evaluation

In `src/core/layout/layout-metrics.ts`, metric scoring does:

- `O(N^2)` node overlap checks
- `O(E^2)` edge crossing checks
- `O(E*N)` edge-node overlap checks

That matters in benchmarks and any future optimization loops that rely on metric scoring.

### 3. History snapshot cloning

In `src/core/history/undo-redo.ts`, `push`, `undo`, and `redo` use `structuredClone` on whole snapshots.

This is not a current problem, but it is the main broader workflow area that could become expensive if diagrams get much larger.

## Best Opportunities

### Priority 1: Improve edge routing without changing routing quality

This is the best place to improve item 2 without impacting quality.

The safest changes are changes that preserve the current scoring model, penalties, tie-break rules, and candidate set, while reducing repeated work.

#### One-at-a-time experiment results

I compared the baseline router against one optimization at a time before enabling any change in the core product.

The experiment checked that each variant preserved:

- exact placements
- evaluator metrics
- objective metrics

All four tested variants preserved quality on the benchmark fixtures.

Measured speed deltas versus baseline:

- `cache-current-edge-geometries`
  - `route-40-chain`: `-20.9%`
  - `route-31-tree`: `-28.4%`
  - `route-24-dense`: `-44.4%`
  - `route-12-cyclic`: `-42.0%`
- `cache-candidate-geometries`
  - `route-40-chain`: `+5.9%`
  - `route-31-tree`: `-7.8%`
  - `route-24-dense`: `-13.1%`
  - `route-12-cyclic`: `-9.8%`
- `precompute-candidates`
  - `route-40-chain`: `+16.2%`
  - `route-31-tree`: `+2.1%`
  - `route-24-dense`: `-2.5%`
  - `route-12-cyclic`: `-2.0%`
- `prune-intersection-checks`
  - `route-40-chain`: `-2.3%`
  - `route-31-tree`: `-27.4%`
  - `route-24-dense`: `+9.1%`
  - `route-12-cyclic`: `+44.7%`

Interpretation:

- `cache-current-edge-geometries` is the clear winner. It was the only optimization that helped every fixture and it produced the largest improvement on the dense case.
- `cache-candidate-geometries` is promising but mixed. It helps on tree, dense, and cyclic cases, but regressed the chain fixture in this run.
- `precompute-candidates` is not worth shipping by itself.
- `prune-intersection-checks` is not worth shipping in its current form. The extra bounding-box work helps some fixtures but loses badly on dense and cyclic cases.

Status:

- `cache-current-edge-geometries` is now enabled in the default router.
- The other experimental variants were removed rather than kept behind flags.

#### Best safe opportunities

1. Cache current geometry for other edges inside each pass

- In the inner loop, each candidate checks against every other edge and rebuilds that other edge's geometry every time.
- Maintain a map from `edge.id` to the currently selected geometry for the current pass.
- Update only the current edge's geometry when its placement changes.

Why it is safe:

- Same comparison set
- Same intersection logic
- Same scores
- Same placements and quality metrics in the benchmark
- Largest measured speedup across all fixtures

2. Cache candidate geometries per edge and placement

- Today the router rebuilds geometry repeatedly for the same edge/candidate pair.
- Cache `buildEdgeRoutingGeometry()` results and `getPolylineLength()` results for the duration of a routing pass.
- This preserved quality in the benchmark and helped the dense case materially.

Why it is safe:

- Same candidates
- Same scores
- Same placements and quality metrics in the benchmark
- Only less recomputation

3. Precompute and reuse candidate lists

- `createPlacementCandidates()` is called repeatedly for the same edge within the same routing run.
- Build the candidate list once per edge and reuse it across both passes.
- This preserved quality in the benchmark, but the speedup was too small and too inconsistent to justify prioritizing it.

Why it is safe:

- Candidate order stays the same
- Candidate contents stay the same
- No scoring behavior changes

4. Add cheap spatial pruning before exact intersection checks

- Most candidate-vs-node and candidate-vs-edge pairs cannot intersect.
- Add bounding-box rejection before `polylineIntersectsBox()` and `polylinesIntersect()`.
- This preserved quality in the benchmark, but the current implementation was too inconsistent to recommend first.

Why it is safe:

- Exact checks still run for all possible intersections
- The algorithm only skips pairs that are provably impossible
- Quality should remain unchanged if pruning is conservative

5. Reuse routing results when geometry is unchanged

- If node boxes and the edge set have not changed, reuse stored placements rather than recomputing from scratch.
- This is especially useful after operations that do not affect layout geometry.

Why it is safe:

- Reusing an already computed placement does not reduce quality
- It avoids unnecessary reruns on identical inputs

### Priority 2: Make metric evaluation cheaper when used for analysis

If more performance work requires repeated metric scoring:

- cache routed geometries in `computeRoutedEdgeGeometries()`
- avoid recomputing placements when edges already have explicit sides
- add conservative spatial pruning for box and segment checks

This is useful, but it is lower leverage than fixing the routing loop itself.

### Priority 3: Prepare for larger history sizes

If very large diagrams become common:

- consider structural sharing or patch-based undo instead of full snapshot cloning

This is not urgent based on current numbers.

## Recommended Order

1. Cache currently selected geometry for other edges during each routing pass
2. Cache edge-routing candidate geometry and lengths
3. Re-run the one-at-a-time benchmark and then test the combination of 1 and 2
4. Leave candidate precomputation and pruning behind a benchmark gate until they show stable wins
5. Profile again before changing scoring rules or penalties

## What Not To Change First

To preserve quality, avoid starting with:

- reducing the candidate set
- changing penalty weights
- reducing routing passes
- simplifying tie-break rules
- switching to a different routing algorithm

Those changes may improve speed, but they carry a real quality risk.

## Bottom Line

The best quality-preserving performance work is inside the current edge-routing implementation.

The first pass should now be narrower:

- cache current edge state for other edges inside the pass
- cache candidate geometry and length for reused placements

Those two changes are the best measured opportunities to reduce routing time without changing the routing decisions the app makes today.
