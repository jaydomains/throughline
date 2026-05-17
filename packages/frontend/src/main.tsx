import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import './fonts.css';
import './styles.css';

// v1 hardcodes Direction A · dark · comfortable (the design-handoff default).
// Slice 4 replaces this with an early settings fetch + SSE hot-reload.
document.body.setAttribute('data-direction', 'A');
document.body.setAttribute('data-theme', 'dark');
document.body.setAttribute('data-density', 'comfortable');

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('no #root element');

createRoot(rootEl).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
