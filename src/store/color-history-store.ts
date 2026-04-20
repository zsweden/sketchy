import { getWebStorage } from '../utils/web-storage';

const STORAGE_KEY = 'sketchy-recent-colors';
const MAX_RECENT_COLORS = 8;

type RecentColorKind = 'background' | 'text';

interface StoredRecentColors {
  background: string[];
  text: string[];
}

let cachedRecentColors: StoredRecentColors | null = null;

export function normalizeHexColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return undefined;
  if (trimmed.length === 4) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return trimmed.toUpperCase();
}

function sanitizeRecentColors(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = typeof value === 'string' ? normalizeHexColor(value) : undefined;
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= MAX_RECENT_COLORS) break;
  }
  return out;
}

function loadRecentColors(): StoredRecentColors {
  if (cachedRecentColors) return cachedRecentColors;
  const raw = getWebStorage('localStorage')?.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<StoredRecentColors>;
      return cachedRecentColors = {
        background: sanitizeRecentColors(parsed.background),
        text: sanitizeRecentColors(parsed.text),
      };
    } catch { /* fall through to empty */ }
  }
  return cachedRecentColors = { background: [], text: [] };
}

function saveRecentColors(next: StoredRecentColors) {
  cachedRecentColors = next;
  try {
    getWebStorage('localStorage')?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* in-memory cache still works */ }
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
    [kind]: [normalized, ...current[kind].filter((e) => e !== normalized)].slice(0, MAX_RECENT_COLORS),
  };
  saveRecentColors(next);
  return next[kind];
}

export function resetRecentColorsForTests() {
  cachedRecentColors = null;
  getWebStorage('localStorage')?.removeItem(STORAGE_KEY);
}
