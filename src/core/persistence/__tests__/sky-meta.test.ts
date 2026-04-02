import { describe, it, expect } from 'vitest';
import { buildSkyMeta } from '../sky-meta';
import { createEmptyDiagram } from '../../types';

describe('buildSkyMeta', () => {
  it('populates all fields for CRT framework', () => {
    const diagram = createEmptyDiagram('crt');
    const meta = buildSkyMeta(diagram);

    expect(meta.app).toContain('Sketchy');
    expect(meta.fileFormat).toContain('documentation only');

    expect(meta.framework.name).toBe('Current Reality Tree');
    expect(meta.framework.description).toBeTruthy();
    expect(meta.framework.edgeSemantics).toContain('causes');

    expect(meta.junctionSemantics).toContain('and');
    expect(meta.junctionSemantics).toContain('or');

    expect(meta.tags['ude']).toContain('Undesirable Effect');

    expect(meta.derivedIndicators).toContain('Root Cause');
    expect(meta.derivedIndicators).toContain('Intermediate Effect');
    expect(meta.derivedIndicators).toContain('Not stored');

    expect(meta.settings.layoutDirection).toContain('TB');
    expect(meta.settings.layoutDirection).toContain('BT');
    expect(meta.settings.layoutDirection).toContain('LR');
    expect(meta.settings.layoutDirection).toContain('RL');
  });

  it('handles unknown framework gracefully', () => {
    const diagram = createEmptyDiagram('nonexistent');
    const meta = buildSkyMeta(diagram);

    expect(meta.app).toContain('Sketchy');
    expect(meta.framework.name).toBe('nonexistent');
    expect(meta.framework.description).toBe('Unknown framework');
    expect(meta.tags).toEqual({});
    expect(meta.junctionSemantics).toBeUndefined();
  });
});
