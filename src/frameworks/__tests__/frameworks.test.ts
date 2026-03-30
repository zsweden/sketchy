import { describe, expect, it } from 'vitest';
import { crtFramework } from '../crt';
import { frtFramework } from '../frt';
import { prtFramework } from '../prt';
import { sttFramework } from '../stt';
import { cldFramework } from '../cld';
import type { Framework } from '../../core/framework-types';

const ALL_FRAMEWORKS: Framework[] = [
  crtFramework,
  frtFramework,
  prtFramework,
  sttFramework,
  cldFramework,
];

describe('framework definitions', () => {
  it('all frameworks have unique ids', () => {
    const ids = ALL_FRAMEWORKS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all frameworks have unique names', () => {
    const names = ALL_FRAMEWORKS.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(ALL_FRAMEWORKS.map((f) => [f.id, f]))('%s has required base properties', (_id, fw) => {
    expect(fw.id).toBeTruthy();
    expect(fw.name).toBeTruthy();
    expect(fw.description).toBeTruthy();
    expect(['TB', 'BT']).toContain(fw.defaultLayoutDirection);
    expect(fw.nodeTags).toBeInstanceOf(Array);
    expect(fw.derivedIndicators).toBeInstanceOf(Array);
  });

  describe('CRT', () => {
    it('has bottom-to-top direction', () => {
      expect(crtFramework.defaultLayoutDirection).toBe('BT');
    });

    it('supports junctions', () => {
      expect(crtFramework.supportsJunctions).toBe(true);
    });

    it('has UDE tag with correct properties', () => {
      expect(crtFramework.nodeTags).toHaveLength(1);
      const ude = crtFramework.nodeTags[0];
      expect(ude.id).toBe('ude');
      expect(ude.shortName).toBe('UDE');
      expect(ude.color).toBeTruthy();
    });

    it('has root-cause and intermediate derived indicators', () => {
      expect(crtFramework.derivedIndicators.length).toBeGreaterThanOrEqual(2);
      const ids = crtFramework.derivedIndicators.map((d) => d.id);
      expect(ids).toContain('root-cause');
      expect(ids).toContain('intermediate');
    });

    it('does not allow cycles', () => {
      expect(crtFramework.allowsCycles).toBeFalsy();
    });
  });

  describe('FRT', () => {
    it('has injection and DE tags', () => {
      expect(frtFramework.nodeTags).toHaveLength(2);
      const tagIds = frtFramework.nodeTags.map((t) => t.id);
      expect(tagIds).toContain('injection');
      expect(tagIds).toContain('de');
    });

    it('supports junctions', () => {
      expect(frtFramework.supportsJunctions).toBe(true);
    });
  });

  describe('PRT', () => {
    it('has obstacle, IO, and goal tags', () => {
      expect(prtFramework.nodeTags).toHaveLength(3);
      const tagIds = prtFramework.nodeTags.map((t) => t.id);
      expect(tagIds).toContain('obstacle');
      expect(tagIds).toContain('io');
      expect(tagIds).toContain('goal');
    });

    it('has starting-point, milestone, and target derived indicators', () => {
      const ids = prtFramework.derivedIndicators.map((d) => d.id);
      expect(ids).toContain('starting-point');
      expect(ids).toContain('milestone');
      expect(ids).toContain('target');
    });
  });

  describe('STT', () => {
    it('has top-to-bottom direction', () => {
      expect(sttFramework.defaultLayoutDirection).toBe('TB');
    });

    it('has objective, strategy, and tactic tags', () => {
      const tagIds = sttFramework.nodeTags.map((t) => t.id);
      expect(tagIds).toContain('objective');
      expect(tagIds).toContain('strategy');
      expect(tagIds).toContain('tactic');
    });
  });

  describe('CLD', () => {
    it('allows cycles', () => {
      expect(cldFramework.allowsCycles).toBe(true);
    });

    it('does not support junctions', () => {
      expect(cldFramework.supportsJunctions).toBeFalsy();
    });

    it('supports edge polarity and delay', () => {
      expect(cldFramework.supportsEdgePolarity).toBe(true);
      expect(cldFramework.supportsEdgeDelay).toBe(true);
    });

    it('has no node tags', () => {
      expect(cldFramework.nodeTags).toHaveLength(0);
    });

    it('has no derived indicators', () => {
      expect(cldFramework.derivedIndicators).toHaveLength(0);
    });
  });

  describe('tag properties', () => {
    it.each(
      ALL_FRAMEWORKS.flatMap((fw) =>
        fw.nodeTags.map((tag) => [`${fw.id}/${tag.id}`, tag]),
      ),
    )('%s has required tag properties', (_label, tag) => {
      expect(tag.id).toBeTruthy();
      expect(tag.name).toBeTruthy();
      expect(tag.shortName).toBeTruthy();
      expect(tag.color).toMatch(/^#/);
      expect(tag.description).toBeTruthy();
    });
  });

  describe('derived indicator properties', () => {
    it.each(
      ALL_FRAMEWORKS.flatMap((fw) =>
        fw.derivedIndicators.map((ind) => [`${fw.id}/${ind.id}`, ind]),
      ),
    )('%s has required indicator properties', (_label, ind) => {
      expect(ind.id).toBeTruthy();
      expect(ind.shortName).toBeTruthy();
      expect(ind.color).toMatch(/^#/);
      expect(ind.description).toBeTruthy();
      expect(['indegree-zero', 'leaf', 'indegree-and-outdegree']).toContain(ind.condition);
    });
  });
});
