import { normalizeHexColor } from '../../store/color-history-store';

export function colorsMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a && !b) return true;

  const normalizedA = normalizeHexColor(a);
  const normalizedB = normalizeHexColor(b);
  if (normalizedA && normalizedB) {
    return normalizedA === normalizedB;
  }

  return a === b;
}
