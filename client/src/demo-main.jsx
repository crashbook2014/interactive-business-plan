// Entry for the shareable single-file demo: installs the in-browser API
// before the app mounts, so every call runs against in-memory sample data.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { demoApi } from './demoApi.js';
import App from './App.jsx';
import './styles.css';

window.__demoApi = demoApi;
createRoot(document.getElementById('root')).render(<App />);
