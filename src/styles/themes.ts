// --- Theme definitions ---

export type ThemeId =
  | 'forest'
  | 'figma-dark'
  | 'midnight'
  | 'nord'
  | 'ocean'
  | 'rose'
  | 'sky-light'
  | 'solarized-light'
  | 'warm-light';

interface ThemeDefinition {
  id: ThemeId;
  name: string;
  vars: Record<string, string>;
  js: {
    arrowColor: string;
    arrowColorSelected: string;
    edgeLabelBg: string;
    minimapFallback: string;
  };
}

interface ThemeColors {
  appBgTop: string;
  appBgBottom: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSoft: string;
  accent: string;
  accentHover: string;
  accentShadow: string;
  secondary: string;
  secondaryHover: string;
  shadow: string;
  headerBg: string;
  toggleThumb: string;
  edgeLabelBg: string;
  minimapFallback: string;
}

const SHARED_VARS: Record<string, string> = {
  '--loop-reinforcing': '#4CAF50',
  '--loop-balancing': '#FB8C00',
  '--loop-info': '#5C8DB5',
  '--loop-muted': '#8A8A7A',
};

function createTheme(id: ThemeId, name: string, c: ThemeColors): ThemeDefinition {
  return {
    id,
    name,
    vars: {
      '--app-bg-top': c.appBgTop,
      '--app-bg-bottom': c.appBgBottom,
      '--surface': c.surface,
      '--surface-muted': c.surfaceMuted,
      '--border': c.border,
      '--border-strong': c.borderStrong,
      '--text': c.text,
      '--text-muted': c.textMuted,
      '--text-soft': c.textSoft,
      '--accent': c.accent,
      '--accent-hover': c.accentHover,
      '--accent-shadow': c.accentShadow,
      '--secondary': c.secondary,
      '--secondary-hover': c.secondaryHover,
      '--shadow': c.shadow,
      '--header-bg': c.headerBg,
      '--toggle-thumb': c.toggleThumb,
      ...SHARED_VARS,
    },
    js: {
      arrowColor: c.textSoft,
      arrowColorSelected: c.text,
      edgeLabelBg: c.edgeLabelBg,
      minimapFallback: c.minimapFallback,
    },
  };
}

export const THEMES: ThemeDefinition[] = [
  createTheme('forest', 'Forest', {
    appBgTop: '#1A2421', appBgBottom: '#141E1A',
    surface: '#243029', surfaceMuted: '#2D3B34',
    border: '#3D5247', borderStrong: '#4D6558',
    text: '#E8F0EC', textMuted: '#B8D0C4', textSoft: '#88A898',
    accent: '#10B981', accentHover: '#34D399', accentShadow: 'rgba(16, 185, 129, 0.25)',
    secondary: '#2D3B34', secondaryHover: '#3D5247',
    shadow: '0 20px 45px rgba(0, 0, 0, 0.35)',
    headerBg: 'rgba(26, 36, 33, 0.92)', toggleThumb: '#E8F0EC',
    edgeLabelBg: 'rgba(36, 48, 41, 0.92)', minimapFallback: '#3D5247',
  }),
  createTheme('figma-dark', 'Graphite', {
    appBgTop: '#1E1E1E', appBgBottom: '#1A1A1A',
    surface: '#2D2D2D', surfaceMuted: '#3A3A3A',
    border: '#5A5A5A', borderStrong: '#6A6A6A',
    text: '#F0F0F0', textMuted: '#C0C0C0', textSoft: '#A0A0A0',
    accent: '#0C8CE9', accentHover: '#3DA8F5', accentShadow: 'rgba(12, 140, 233, 0.25)',
    secondary: '#3A3A3A', secondaryHover: '#4A4A4A',
    shadow: '0 20px 45px rgba(0, 0, 0, 0.3)',
    headerBg: 'rgba(30, 30, 30, 0.92)', toggleThumb: '#E5E5E5',
    edgeLabelBg: 'rgba(45, 45, 45, 0.92)', minimapFallback: '#555555',
  }),
  createTheme('midnight', 'Midnight', {
    appBgTop: '#0D1117', appBgBottom: '#090C10',
    surface: '#161B22', surfaceMuted: '#21262D',
    border: '#30363D', borderStrong: '#484F58',
    text: '#F0F6FC', textMuted: '#C9D1D9', textSoft: '#8B949E',
    accent: '#58A6FF', accentHover: '#79C0FF', accentShadow: 'rgba(88, 166, 255, 0.25)',
    secondary: '#21262D', secondaryHover: '#30363D',
    shadow: '0 20px 45px rgba(0, 0, 0, 0.5)',
    headerBg: 'rgba(13, 17, 23, 0.92)', toggleThumb: '#F0F6FC',
    edgeLabelBg: 'rgba(22, 27, 34, 0.92)', minimapFallback: '#30363D',
  }),
  createTheme('nord', 'Nord', {
    appBgTop: '#2E3440', appBgBottom: '#272C36',
    surface: '#3B4252', surfaceMuted: '#434C5E',
    border: '#4C566A', borderStrong: '#616E88',
    text: '#ECEFF4', textMuted: '#D8DEE9', textSoft: '#9BA4B4',
    accent: '#88C0D0', accentHover: '#8FBCBB', accentShadow: 'rgba(136, 192, 208, 0.25)',
    secondary: '#434C5E', secondaryHover: '#4C566A',
    shadow: '0 20px 45px rgba(0, 0, 0, 0.3)',
    headerBg: 'rgba(46, 52, 64, 0.92)', toggleThumb: '#ECEFF4',
    edgeLabelBg: 'rgba(59, 66, 82, 0.92)', minimapFallback: '#4C566A',
  }),
  createTheme('ocean', 'Ocean', {
    appBgTop: '#1B2838', appBgBottom: '#151F2E',
    surface: '#243447', surfaceMuted: '#2C3E52',
    border: '#3A5068', borderStrong: '#4A6278',
    text: '#E8EEF4', textMuted: '#B8CCD8', textSoft: '#8AA4B8',
    accent: '#4DA6FF', accentHover: '#70B8FF', accentShadow: 'rgba(77, 166, 255, 0.25)',
    secondary: '#2C3E52', secondaryHover: '#3A5068',
    shadow: '0 20px 45px rgba(0, 0, 0, 0.35)',
    headerBg: 'rgba(27, 40, 56, 0.92)', toggleThumb: '#E8EEF4',
    edgeLabelBg: 'rgba(36, 52, 71, 0.92)', minimapFallback: '#3A5068',
  }),
  createTheme('rose', 'Rose', {
    appBgTop: '#FFF5F5', appBgBottom: '#FEE2E2',
    surface: '#FFFFFF', surfaceMuted: '#FFF0F0',
    border: '#FECACA', borderStrong: '#FDA4AF',
    text: '#1F1215', textMuted: '#6B3A3A', textSoft: '#9F6565',
    accent: '#E11D48', accentHover: '#BE123C', accentShadow: 'rgba(225, 29, 72, 0.2)',
    secondary: '#FFE4E6', secondaryHover: '#FECDD3',
    shadow: '0 20px 45px rgba(31, 18, 21, 0.06)',
    headerBg: 'rgba(255, 245, 245, 0.88)', toggleThumb: '#ffffff',
    edgeLabelBg: 'rgba(255, 245, 245, 0.92)', minimapFallback: '#FECACA',
  }),
  createTheme('sky-light', 'Sky Light', {
    appBgTop: '#F3FAFF', appBgBottom: '#DCEFFF',
    surface: '#FFFFFF', surfaceMuted: '#EDF6FF',
    border: '#C7DDF3', borderStrong: '#A9C7E8',
    text: '#16324A', textMuted: '#4C6882', textSoft: '#7290AA',
    accent: '#4A9DFF', accentHover: '#2E8AF5', accentShadow: 'rgba(74, 157, 255, 0.2)',
    secondary: '#E0EEFB', secondaryHover: '#CFE4F8',
    shadow: '0 20px 45px rgba(22, 50, 74, 0.08)',
    headerBg: 'rgba(243, 250, 255, 0.88)', toggleThumb: '#ffffff',
    edgeLabelBg: 'rgba(255, 255, 255, 0.92)', minimapFallback: '#A9C7E8',
  }),
  createTheme('solarized-light', 'Solarized Light', {
    appBgTop: '#FDF6E3', appBgBottom: '#F5EDDA',
    surface: '#FFFDF5', surfaceMuted: '#F5EDDA',
    border: '#E0D8C0', borderStrong: '#D0C8A8',
    text: '#073642', textMuted: '#586E75', textSoft: '#93A1A1',
    accent: '#268BD2', accentHover: '#1A7ABF', accentShadow: 'rgba(38, 139, 210, 0.2)',
    secondary: '#EEE8D5', secondaryHover: '#E0DACB',
    shadow: '0 20px 45px rgba(7, 54, 66, 0.06)',
    headerBg: 'rgba(253, 246, 227, 0.88)', toggleThumb: '#ffffff',
    edgeLabelBg: 'rgba(253, 246, 227, 0.92)', minimapFallback: '#D0C8A8',
  }),
  createTheme('warm-light', 'Warm Light', {
    appBgTop: '#F5F5EC', appBgBottom: '#EBE9E0',
    surface: 'rgba(255, 255, 255, 0.96)', surfaceMuted: '#F0EDE4',
    border: '#E0DDD4', borderStrong: '#D4D0C6',
    text: '#212121', textMuted: '#6B6B6B', textSoft: '#8A8A7A',
    accent: '#212121', accentHover: '#3a3a3a', accentShadow: 'rgba(33, 33, 33, 0.18)',
    secondary: '#E8E4DA', secondaryHover: '#DDD8CC',
    shadow: '0 20px 45px rgba(33, 33, 33, 0.06)',
    headerBg: 'rgba(245, 245, 236, 0.85)', toggleThumb: '#ffffff',
    edgeLabelBg: 'rgba(255, 255, 255, 0.92)', minimapFallback: '#D4D0C6',
  }),
];

const DEFAULT_THEME: ThemeId = 'figma-dark';

export function getTheme(id: string): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function applyThemeToRoot(id: string, root: HTMLElement = document.documentElement): void {
  const theme = getTheme(id);

  for (const [prop, value] of Object.entries(theme.vars)) {
    root.style.setProperty(prop, value);
  }

  root.style.color = theme.vars['--text'];
  root.style.background = theme.vars['--app-bg-top'];
}

export { DEFAULT_THEME };
