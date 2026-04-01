import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { installGlobalErrorLogging } from './core/monitoring/error-logging';
import { applyThemeToRoot, DEFAULT_THEME } from './styles/themes';

const SETTINGS_STORAGE_KEY = 'sketchy-settings';

function applyInitialTheme() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    applyThemeToRoot(parsed?.theme ?? DEFAULT_THEME);
  } catch {
    applyThemeToRoot(DEFAULT_THEME);
  }
}

installGlobalErrorLogging();
applyInitialTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
