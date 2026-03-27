import { describe, it, expect } from 'vitest';
import { getFramework, listFrameworks, registerFramework } from '../registry';

describe('framework registry', () => {
  it('has CRT registered by default', () => {
    const crt = getFramework('crt');
    expect(crt).toBeDefined();
    expect(crt!.name).toBe('Current Reality Tree');
  });

  it('returns undefined for unknown framework', () => {
    expect(getFramework('nonexistent')).toBeUndefined();
  });

  it('lists all frameworks', () => {
    const frameworks = listFrameworks();
    expect(frameworks.length).toBeGreaterThanOrEqual(1);
    expect(frameworks.some((f) => f.id === 'crt')).toBe(true);
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
