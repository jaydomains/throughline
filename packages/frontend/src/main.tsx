import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { api } from './api.js';
import { applyTheme, readTheme, DEFAULT_THEME } from './theme.js';
import './fonts.css';
import './styles.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('no #root element');

function mount() {
  createRoot(rootEl as HTMLElement).render(
    <React.StrictMode>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
}

// Fetch the persisted theme before first paint so the app never flashes the
// wrong direction/mode/density (FOUC). On any failure, fall back to the v1
// default and mount anyway — the theme is chrome, not a load barrier.
api
  .getSettings()
  .then((r) => applyTheme(readTheme(r.settings)))
  .catch(() => applyTheme(DEFAULT_THEME))
  .finally(mount);
