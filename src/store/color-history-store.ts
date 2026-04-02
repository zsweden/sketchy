import { getWebStorage } from '../utils/web-storage';

const STORAGE_KEY = 'sketchy-recent-colors';
const MAX_RECENT_COLORS = 8;

export type RecentColorKind = 'background' | 'text';

interface StoredRecentColors {
  background: string[];
  text: string[];
}

let cachedRecentColors: StoredRecentColors | null = null;

function createEmptyRecentColors(): StoredRecentColors {
  return {
    background: [],
    text: [],
  };
}

export function normalizeHexColor(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) {
    return undefined;
  }

  if (trimmed.length === 4) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  return trimmed.toUpperCase();
}

function sanitizeRecentColors(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  const seen = new Set<string>();
  const normalizedValues: string[] = [];

  for (const value of values) {
    const normalized = typeof value === 'string' ? normalizeHexColor(value) : undefined;
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    normalizedValues.push(normalized);
    if (normalizedValues.length >= MAX_RECENT_COLORS) break;
  }

  return normalizedValues;
}

function loadRecentColors(): StoredRecentColors {
  if (cachedRecentColors) return cachedRecentColors;

  const storage = getWebStorage('localStorage');
  if (!storage) {
    cachedRecentColors = createEmptyRecentColors();
    return cachedRecentColors;
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      cachedRecentColors = createEmptyRecentColors();
      return cachedRecentColors;
    }

    const parsed = JSON.parse(raw) as Partial<StoredRecentColors>;
    cachedRecentColors = {
      background: sanitizeRecentColors(parsed.background),
      text: sanitizeRecentColors(parsed.text),
    };
    return cachedRecentColors;
  } catch {
    cachedRecentColors = createEmptyRecentColors();
    return cachedRecentColors;
  }
}

function saveRecentColors(next: StoredRecentColors) {
  cachedRecentColors = next;

  const storage = getWebStorage('localStorage');
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures; the in-memory cache still works for this session.
  }
}

export function getRecentColors(kind: RecentColorKind): string[] {
  return loadRecentColors()[kind];
}

export function rememberRecentColor(
  kind: RecentColorKind,
  color: string | undefined,
): string[] {
  const normalized = normalizeHexColor(color);
  if (!normalized) return getRecentColors(kind);

  const current = loadRecentColors();
  const next = {
    ...current,
    [kind]: [
      normalized,
      ...current[kind].filter((entry) => entry !== normalized),
    ].slice(0, MAX_RECENT_COLORS),
  };

  saveRecentColors(next);
  return next[kind];
}

export function resetRecentColorsForTests() {
  cachedRecentColors = null;
  getWebStorage('localStorage')?.removeItem(STORAGE_KEY);
}
