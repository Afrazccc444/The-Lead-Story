import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import '@fontsource-variable/playfair-display';
import '@fontsource-variable/playfair-display/wght-italic.css';
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/source-serif-4/wght-italic.css';
import '@fontsource-variable/inter';

import './styles/tokens.css';
import './styles/base.css';
import './styles/newsletter.css';
import './styles/admin.css';
import './styles/blocks.css';
import './styles/intro.css';
import './styles/reader.css';
import './styles/layout-rails.css';
import './styles/broadcast.css';
import './styles/typography.css';
import './styles/cinematic.css';
import './styles/print.css';

import App from './App.jsx';

// Offline support: only in the built site (not while developing), never for the editor's API.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
