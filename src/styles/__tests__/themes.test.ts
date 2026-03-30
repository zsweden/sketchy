import { describe, expect, it } from 'vitest';
import { THEMES, getTheme, DEFAULT_THEME, type ThemeId } from '../themes';

const REQUIRED_CSS_VARS = [
  '--app-bg-top',
  '--app-bg-bottom',
  '--surface',
  '--surface-muted',
  '--border',
  '--border-strong',
  '--text',
  '--text-muted',
  '--text-soft',
  '--accent',
  '--accent-hover',
  '--accent-shadow',
  '--secondary',
  '--secondary-hover',
  '--shadow',
  '--header-bg',
  '--toggle-thumb',
];

const REQUIRED_JS_KEYS = [
  'arrowColor',
  'arrowColorSelected',
  'edgeLabelBg',
  'minimapFallback',
];

describe('themes', () => {
  it('exports at least 8 themes', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(8);
  });

  it('has unique ids across all themes', () => {
    const ids = THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique names across all themes', () => {
    const names = THEMES.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(THEMES.map((t) => [t.id, t]))('%s has all required CSS variables', (_id, theme) => {
    for (const cssVar of REQUIRED_CSS_VARS) {
      expect(theme.vars, `${theme.id} missing ${cssVar}`).toHaveProperty(cssVar);
      expect(theme.vars[cssVar]).toBeTruthy();
    }
  });

  it.each(THEMES.map((t) => [t.id, t]))('%s has all required JS properties', (_id, theme) => {
    for (const key of REQUIRED_JS_KEYS) {
      expect(theme.js, `${theme.id} missing js.${key}`).toHaveProperty(key);
      expect(theme.js[key as keyof typeof theme.js]).toBeTruthy();
    }
  });

  it('getTheme returns the correct theme by id', () => {
    const theme = getTheme('nord');
    expect(theme.id).toBe('nord');
    expect(theme.name).toBe('Nord');
  });

  it('getTheme falls back to first theme for unknown id', () => {
    const theme = getTheme('nonexistent');
    expect(theme.id).toBe(THEMES[0].id);
  });

  it('DEFAULT_THEME is a valid theme id', () => {
    const theme = getTheme(DEFAULT_THEME);
    expect(theme.id).toBe(DEFAULT_THEME);
  });

  it('every theme id matches the ThemeId union type', () => {
    const validIds: ThemeId[] = [
      'forest', 'figma-dark', 'midnight', 'nord',
      'ocean', 'rose', 'solarized-light', 'warm-light',
    ];
    for (const theme of THEMES) {
      expect(validIds).toContain(theme.id);
    }
  });
});
