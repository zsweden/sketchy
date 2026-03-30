import { useEffect } from 'react';
import { useSettingsStore } from '../store/settings-store';
import { getTheme } from '../styles/themes';

export function useThemeEffect() {
  const themeId = useSettingsStore((s) => s.theme);

  useEffect(() => {
    const theme = getTheme(themeId);
    const root = document.documentElement;

    for (const [prop, value] of Object.entries(theme.vars)) {
      root.style.setProperty(prop, value);
    }

    root.style.color = theme.vars['--text'];
    root.style.background = theme.vars['--app-bg-top'];
  }, [themeId]);
}
