import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OrthogonalEdge from '../OrthogonalEdge';

const mocks = vi.hoisted(() => ({
  baseEdge: vi.fn(() => null),
}));

vi.mock('@xyflow/react', () => ({
  BaseEdge: (props: unknown) => {
    mocks.baseEdge(props);
    return null;
  },
  Position: {
    Top: 'top',
    Right: 'right',
    Bottom: 'bottom',
    Left: 'left',
  },
}));

describe('OrthogonalEdge', () => {
  it('renders the optimizer-style orthogonal path between the provided anchors', () => {
    render(
      <OrthogonalEdge
        id="e1"
        sourceX={272}
        sourceY={516}
        targetX={200}
        targetY={170}
        sourcePosition={'top' as never}
        targetPosition={'bottom' as never}
        markerEnd="url(#arrow)"
        selected={false}
        source="a"
        target="b"
      />,
    );

    expect(mocks.baseEdge).toHaveBeenCalledWith(expect.objectContaining({
      path: 'M272 516L272 488L272 343L200 343L200 198L200 170',
      labelX: 236,
      labelY: 343,
    }));
  });
});
