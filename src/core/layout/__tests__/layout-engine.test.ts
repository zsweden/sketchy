import { describe, it, expect } from 'vitest';
import { estimateHeight, MIN_NODE_HEIGHT } from '../layout-engine';
import { resolveElkAlgorithm } from '../elk-engine';

describe('estimateHeight', () => {
  it('returns MIN_NODE_HEIGHT (60) for empty label', () => {
    expect(estimateHeight('')).toBe(MIN_NODE_HEIGHT);
  });

  it('returns 1-line height for short label (under 30 chars)', () => {
    const label = 'Short label'; // 11 chars, 1 line
    // 1 line * 24 lineHeight + 24 padding = 48, but MIN_NODE_HEIGHT now floors this to 60
    expect(estimateHeight(label)).toBe(60);
  });

  it('returns multi-line height for long label (60+ chars)', () => {
    const label = 'A'.repeat(60); // 60 chars → ceil(60/30) = 2 lines
    // 2 lines * 24 + 24 = 72
    expect(estimateHeight(label)).toBe(72);
  });

  it('adds 20px when hasBadges is true', () => {
    const label = 'A'.repeat(60);
    const withoutBadges = estimateHeight(label, false);
    const withBadges = estimateHeight(label, true);
    expect(withBadges).toBe(withoutBadges + 20);
  });

  it('computes correct line count for very long label (120 chars)', () => {
    const label = 'A'.repeat(120); // ceil(120/30) = 4 lines
    // 4 lines * 24 + 24 = 120
    expect(estimateHeight(label)).toBe(120);
  });
});

describe('resolveElkAlgorithm', () => {
  it('preserves the requested algorithm for acyclic layouts', () => {
    expect(resolveElkAlgorithm('layered', false)).toBe('layered');
    expect(resolveElkAlgorithm('radial', false)).toBe('radial');
  });

  it('forces cyclic layouts onto the force algorithm', () => {
    expect(resolveElkAlgorithm('layered', true)).toBe('force');
    expect(resolveElkAlgorithm('stress', true)).toBe('force');
  });
});
