# Edge Routing Objectives

This document summarizes the intended objectives for automatic arrow routing and the `Auto edges` command.

## Goal

Choose one source handle and one target handle for each edge so the full set of routed edges is as clean as possible.

## Optimization Order

Treat these as lexicographic objectives, not as equal-weight goals.

1. Minimize edge-edge intersections.
2. Minimize mixed-direction handle conflicts.
3. Minimize total routed edge length.
4. Encourage same-direction handle sharing.
5. Prefer middle handles over corner handles.

## Definitions

### 1. Edge-edge intersections

An intersection occurs when two routed edge polylines cross and the edges do not share an endpoint node.

This is the highest-priority objective.

### 2. Mixed-direction handle conflicts

A mixed-direction handle conflict occurs when, at the same exact node handle point:
- at least one incoming edge uses that handle, and
- at least one outgoing edge uses that handle.

This should be penalized heavily.

### 3. Total routed edge length

Among solutions with the same crossing and mixed-direction-conflict counts, prefer the one with the smaller total routed length.

Length should be measured on the final routed polyline, not just center-to-center node distance.

### 4. Same-direction handle sharing

Encourage multiple incoming edges to use the same exact handle point.

Encourage multiple outgoing edges to use the same exact handle point.

This is desirable as long as it does not increase:
- edge-edge intersections
- mixed-direction handle conflicts
- total routed length at a higher-priority level

### 5. Middle handles over corner handles

All else being equal, prefer cardinal middle handles:
- `top`
- `right`
- `bottom`
- `left`

over corner handles:
- `topleft`
- `topright`
- `bottomright`
- `bottomleft`

This is a tie-break preference, not a primary routing objective.

## Recommended Score Tuple

Compare candidate full-diagram routings by this tuple:

```text
(
  crossings,
  mixed_handle_conflicts,
  total_length,
  -same_direction_sharing,
  corner_handle_count
)
```

Choose the lexicographically smallest tuple.

## Port Accounting

For each `(nodeId, handleSide)`, track:
- `incomingCount`
- `outgoingCount`

Then derive:
- `mixed_handle_conflicts += 1` when both counts are nonzero
- `same_direction_sharing += max(0, incomingCount - 1) + max(0, outgoingCount - 1)`
- `corner_handle_count += 1` for each edge endpoint using a corner handle

## Notes

- The optimization should evaluate the routing as a whole, not just each edge independently.
- The “middle over corner” rule only applies when higher-priority objectives are tied.
- Same-direction sharing is encouraged, but never at the expense of creating mixed in/out use on the same exact handle point.
