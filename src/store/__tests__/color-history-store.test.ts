import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const STORAGE_KEY = 'sketchy-recent-colors';

function makeStorage(initial?: Record<string, string>): Storage {
  const store = new Map<string, string>(
    initial ? Object.entries(initial) : [],
  );
  return {
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
}

// Mock getWebStorage so we can control what storage the module sees
const getWebStorageMock = vi.fn<(name: string) => Storage | null>(() => null);
vi.mock('../../utils/web-storage', () => ({
  getWebStorage: (...args: Parameters<typeof getWebStorageMock>) => getWebStorageMock(...args),
}));

// Import after mock is set up
const {
  normalizeHexColor,
  getRecentColors,
  rememberRecentColor,
  resetRecentColorsForTests,
} = await import('../color-history-store');

beforeEach(() => {
  getWebStorageMock.mockReturnValue(null);
  resetRecentColorsForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('normalizeHexColor', () => {
  it('returns undefined for falsy values', () => {
    expect(normalizeHexColor(undefined)).toBeUndefined();
    expect(normalizeHexColor('')).toBeUndefined();
  });

  it('normalizes 6-digit hex to uppercase', () => {
    expect(normalizeHexColor('#ff00aa')).toBe('#FF00AA');
  });

  it('expands 3-digit hex to 6-digit uppercase', () => {
    expect(normalizeHexColor('#fab')).toBe('#FFAABB');
  });

  it('trims whitespace', () => {
    expect(normalizeHexColor('  #abc  ')).toBe('#AABBCC');
  });

  it('rejects invalid hex strings', () => {
    expect(normalizeHexColor('red')).toBeUndefined();
    expect(normalizeHexColor('#gggggg')).toBeUndefined();
    expect(normalizeHexColor('#12345')).toBeUndefined();
    expect(normalizeHexColor('#1234567')).toBeUndefined();
  });
});

describe('getRecentColors / rememberRecentColor', () => {
  it('returns empty array when no colors saved', () => {
    expect(getRecentColors('background')).toEqual([]);
    expect(getRecentColors('text')).toEqual([]);
  });

  it('remembers a color and retrieves it', () => {
    rememberRecentColor('background', '#ff0000');
    expect(getRecentColors('background')).toEqual(['#FF0000']);
  });

  it('keeps background and text colors separate', () => {
    rememberRecentColor('background', '#ff0000');
    rememberRecentColor('text', '#00ff00');

    expect(getRecentColors('background')).toEqual(['#FF0000']);
    expect(getRecentColors('text')).toEqual(['#00FF00']);
  });

  it('moves a repeated color to the front', () => {
    rememberRecentColor('background', '#ff0000');
    rememberRecentColor('background', '#00ff00');
    rememberRecentColor('background', '#ff0000');

    expect(getRecentColors('background')).toEqual(['#FF0000', '#00FF00']);
  });

  it('caps at 8 recent colors', () => {
    const colors = [
      '#000001', '#000002', '#000003', '#000004',
      '#000005', '#000006', '#000007', '#000008',
      '#000009',
    ];
    for (const c of colors) {
      rememberRecentColor('background', c);
    }

    const result = getRecentColors('background');
    expect(result).toHaveLength(8);
    expect(result[0]).toBe('#000009');
    expect(result).not.toContain('#000001');
  });

  it('ignores invalid color values', () => {
    const result = rememberRecentColor('background', 'not-a-color');
    expect(result).toEqual([]);
  });

  it('ignores undefined color', () => {
    const result = rememberRecentColor('background', undefined);
    expect(result).toEqual([]);
  });
});

describe('localStorage persistence', () => {
  function seedStorage(value: string) {
    const storage = makeStorage();
    getWebStorageMock.mockReturnValue(storage);
    resetRecentColorsForTests(); // clears cache + storage
    storage.setItem(STORAGE_KEY, value); // seed after reset
    return storage;
  }

  it('loads persisted colors from localStorage on cache miss', () => {
    seedStorage(JSON.stringify({
      background: ['#FF0000', '#00FF00'],
      text: ['#0000FF'],
    }));

    expect(getRecentColors('background')).toEqual(['#FF0000', '#00FF00']);
    expect(getRecentColors('text')).toEqual(['#0000FF']);
  });

  it('sanitizes invalid entries when loading from localStorage', () => {
    seedStorage(JSON.stringify({
      background: ['#FF0000', 'not-valid', 42, '#00FF00'],
      text: [],
    }));

    expect(getRecentColors('background')).toEqual(['#FF0000', '#00FF00']);
  });

  it('deduplicates when loading from localStorage', () => {
    seedStorage(JSON.stringify({
      background: ['#FF0000', '#ff0000', '#FF0000'],
      text: [],
    }));

    expect(getRecentColors('background')).toEqual(['#FF0000']);
  });

  it('handles corrupt JSON in localStorage gracefully', () => {
    seedStorage('{not valid json');

    expect(getRecentColors('background')).toEqual([]);
    expect(getRecentColors('text')).toEqual([]);
  });

  it('handles missing keys in stored object', () => {
    seedStorage(JSON.stringify({}));

    expect(getRecentColors('background')).toEqual([]);
    expect(getRecentColors('text')).toEqual([]);
  });

  it('persists remembered colors to storage', () => {
    const storage = makeStorage();
    getWebStorageMock.mockReturnValue(storage);
    resetRecentColorsForTests();

    rememberRecentColor('background', '#aabbcc');

    const raw = storage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.background).toContain('#AABBCC');
  });
});
