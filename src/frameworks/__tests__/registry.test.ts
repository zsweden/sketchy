import { describe, it, expect } from 'vitest';
import { getFramework, getDefaultFramework, listFrameworks, registerFramework } from '../registry';

describe('framework registry', () => {
  it('has core frameworks registered by default', () => {
    const cld = getFramework('cld');
    const crt = getFramework('crt');
    const frt = getFramework('frt');
    const goalTree = getFramework('goal-tree');
    const prt = getFramework('prt');
    const successTree = getFramework('success-tree');
    const stt = getFramework('stt');
    const valueStream = getFramework('value-stream');
    expect(cld).toBeDefined();
    expect(cld!.name).toBe('Causal Loop Diagram');
    expect(crt).toBeDefined();
    expect(crt!.name).toBe('Current Reality Tree');
    expect(frt?.name).toBe('Future Reality Tree');
    expect(goalTree?.name).toBe('Goal Tree');
    expect(prt?.name).toBe('Prerequisite Tree');
    expect(successTree?.name).toBe('Success Tree');
    expect(stt?.name).toBe('Strategy & Tactics Tree');
    expect(valueStream?.name).toBe('Value Stream Map');
  });

  it('returns undefined for unknown framework', () => {
    expect(getFramework('nonexistent')).toBeUndefined();
  });

  it('lists all frameworks', () => {
    const frameworks = listFrameworks();
    expect(frameworks.length).toBeGreaterThanOrEqual(8);
    expect(frameworks.some((f) => f.id === 'cld')).toBe(true);
    expect(frameworks.some((f) => f.id === 'crt')).toBe(true);
    expect(frameworks.some((f) => f.id === 'frt')).toBe(true);
    expect(frameworks.some((f) => f.id === 'goal-tree')).toBe(true);
    expect(frameworks.some((f) => f.id === 'prt')).toBe(true);
    expect(frameworks.some((f) => f.id === 'success-tree')).toBe(true);
    expect(frameworks.some((f) => f.id === 'stt')).toBe(true);
    expect(frameworks.some((f) => f.id === 'value-stream')).toBe(true);
  });

  it('can register a new framework', () => {
    registerFramework({
      id: 'test-fw',
      name: 'Test Framework',
      abbreviation: 'TST',
      description: 'For testing',
      defaultLayoutDirection: 'TB',
      supportsJunctions: false,
      nodeTags: [],
      derivedIndicators: [],
    });
    expect(getFramework('test-fw')).toBeDefined();
  });

  it('returns the alphabetically first framework as default', () => {
    const defaultFw = getDefaultFramework();
    const sorted = listFrameworks().sort((a, b) => a.name.localeCompare(b.name));
    expect(defaultFw.id).toBe(sorted[0].id);
  });

  it('auto-discovers all framework files without manual imports', () => {
    // Every framework .ts file in src/frameworks/ (excluding registry) should be registered
    const all = listFrameworks();
    const ids = all.map((f) => f.id);
    expect(ids).toContain('cld');
    expect(ids).toContain('crt');
    expect(ids).toContain('frt');
    expect(ids).toContain('goal-tree');
    expect(ids).toContain('prt');
    expect(ids).toContain('success-tree');
    expect(ids).toContain('stt');
    expect(ids).toContain('value-stream');
    expect(ids).toContain('vdt');
  });
});
