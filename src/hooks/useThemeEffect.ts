import { useEffect } from 'react';
import { useSettingsStore } from '../store/settings-store';
import { applyThemeToRoot } from '../styles/themes';

export function useThemeEffect() {
  const themeId = useSettingsStore((s) => s.theme);

  useEffect(() => {
    applyThemeToRoot(themeId);
  }, [themeId]);
}
