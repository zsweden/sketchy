import { describe, it, expect } from 'vitest';
import { FIT_VIEW_OPTIONS } from '../fit-view-options';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('fitView consistency', () => {
  it('FIT_VIEW_OPTIONS has required fields', () => {
    expect(FIT_VIEW_OPTIONS).toHaveProperty('padding');
    expect(FIT_VIEW_OPTIONS).toHaveProperty('maxZoom');
    expect(typeof FIT_VIEW_OPTIONS.padding).toBe('number');
    expect(typeof FIT_VIEW_OPTIONS.maxZoom).toBe('number');
  });

  it('padding is between 0 and 1', () => {
    expect(FIT_VIEW_OPTIONS.padding).toBeGreaterThan(0);
    expect(FIT_VIEW_OPTIONS.padding).toBeLessThan(1);
  });

  it('maxZoom caps zoom to prevent over-zoom on small diagrams', () => {
    expect(FIT_VIEW_OPTIONS.maxZoom).toBeGreaterThan(0);
    expect(FIT_VIEW_OPTIONS.maxZoom).toBeLessThanOrEqual(2);
  });

  describe('all fitView call sites use FIT_VIEW_OPTIONS', () => {
    // Read DiagramCanvas source to verify no inline fitView options exist.
    // This prevents future regressions where someone adds a fitView call
    // with different options, causing zoom mismatches between auto-layout
    // and the Controls fit-view button.

    const canvasSource = readFileSync(
      join(__dirname, '../../../components/canvas/DiagramCanvas.tsx'),
      'utf-8',
    );

    it('imports FIT_VIEW_OPTIONS', () => {
      expect(canvasSource).toContain("import { FIT_VIEW_OPTIONS }");
    });

    it('does not contain inline fitView options objects', () => {
      // Match fitView({ ... }) with inline object — these should all use FIT_VIEW_OPTIONS
      const inlineFitViewCalls = canvasSource.match(/fitView\(\s*\{/g);
      expect(inlineFitViewCalls).toBeNull();
    });

    it('passes FIT_VIEW_OPTIONS to fitView calls', () => {
      const fitViewCalls = canvasSource.match(/fitView\(FIT_VIEW_OPTIONS\)/g);
      expect(fitViewCalls).not.toBeNull();
      expect(fitViewCalls!.length).toBeGreaterThanOrEqual(1);
    });

    it('passes FIT_VIEW_OPTIONS to Controls component', () => {
      expect(canvasSource).toContain('Controls fitViewOptions={FIT_VIEW_OPTIONS}');
    });

    it('passes FIT_VIEW_OPTIONS to ReactFlow fitViewOptions prop', () => {
      expect(canvasSource).toContain('fitViewOptions={FIT_VIEW_OPTIONS}');
    });

    it('has no other padding or maxZoom literals near fitView', () => {
      // Ensure no one sneaks in a different padding/maxZoom value
      const lines = canvasSource.split('\n');
      for (const line of lines) {
        if (line.includes('fitView') || line.includes('fitViewOptions')) {
          // These lines should reference FIT_VIEW_OPTIONS, not contain raw numbers
          expect(line).not.toMatch(/padding:\s*0\.\d/);
          expect(line).not.toMatch(/maxZoom:\s*\d/);
        }
      }
    });
  });
});
