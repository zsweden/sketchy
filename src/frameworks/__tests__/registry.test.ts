import { describe, it, expect } from 'vitest';
import { getFramework, listFrameworks, registerFramework } from '../registry';

describe('framework registry', () => {
  it('has core frameworks registered by default', () => {
    const crt = getFramework('crt');
    const frt = getFramework('frt');
    const prt = getFramework('prt');
    const stt = getFramework('stt');
    expect(crt).toBeDefined();
    expect(crt!.name).toBe('Current Reality Tree');
    expect(frt?.name).toBe('Future Reality Tree');
    expect(prt?.name).toBe('Prerequisite Tree');
    expect(stt?.name).toBe('Strategy & Tactics Tree');
  });

  it('returns undefined for unknown framework', () => {
    expect(getFramework('nonexistent')).toBeUndefined();
  });

  it('lists all frameworks', () => {
    const frameworks = listFrameworks();
    expect(frameworks.length).toBeGreaterThanOrEqual(4);
    expect(frameworks.some((f) => f.id === 'crt')).toBe(true);
    expect(frameworks.some((f) => f.id === 'frt')).toBe(true);
    expect(frameworks.some((f) => f.id === 'prt')).toBe(true);
    expect(frameworks.some((f) => f.id === 'stt')).toBe(true);
  });

  it('can register a new framework', () => {
    registerFramework({
      id: 'test-fw',
      name: 'Test Framework',
      description: 'For testing',
      defaultLayoutDirection: 'TB',
      supportsJunctions: false,
      nodeTags: [],
      derivedIndicators: [],
    });
    expect(getFramework('test-fw')).toBeDefined();
  });
});
