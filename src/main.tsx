import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { applyColorTheme, loadCachedColorTheme } from './lib/themes.ts';

// Apply the cached colour theme before first paint so there is no flash of
// the default palette on load. The authoritative per-user theme is applied
// once the session's preferences load.
const cachedTheme = loadCachedColorTheme();
if (cachedTheme) applyColorTheme(cachedTheme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
