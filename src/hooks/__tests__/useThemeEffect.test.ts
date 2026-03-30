import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useThemeEffect } from '../useThemeEffect';
import { useSettingsStore } from '../../store/settings-store';
import { getTheme } from '../../styles/themes';

describe('useThemeEffect', () => {
  beforeEach(() => {
    useSettingsStore.setState({ theme: 'figma-dark' });
    // Clear inline styles
    const root = document.documentElement;
    root.style.cssText = '';
  });

  it('applies theme CSS variables to document root', () => {
    renderHook(() => useThemeEffect());

    const root = document.documentElement;
    const theme = getTheme('figma-dark');

    for (const [prop, value] of Object.entries(theme.vars)) {
      expect(root.style.getPropertyValue(prop)).toBe(value);
    }
  });

  it('sets root color and background', () => {
    renderHook(() => useThemeEffect());

    const root = document.documentElement;
    const theme = getTheme('figma-dark');

    expect(root.style.color).toBeTruthy();
    expect(root.style.background).toBeTruthy();
    // Check they contain the theme values (may be color-converted by jsdom)
    expect(root.style.getPropertyValue('--text')).toBe(theme.vars['--text']);
    expect(root.style.getPropertyValue('--app-bg-top')).toBe(theme.vars['--app-bg-top']);
  });

  it('updates CSS variables when theme changes', () => {
    const { rerender } = renderHook(() => useThemeEffect());

    useSettingsStore.setState({ theme: 'nord' });
    rerender();

    const root = document.documentElement;
    const nord = getTheme('nord');

    expect(root.style.getPropertyValue('--accent')).toBe(nord.vars['--accent']);
    expect(root.style.getPropertyValue('--text')).toBe(nord.vars['--text']);
  });
});
