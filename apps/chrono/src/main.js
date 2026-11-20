import '@simple-web-tools/covenant';
import './styles/app.css';

// Entry point: mounts the application in #root once the DOM is ready.
import { start } from './adapters/dom/App.js';

function startSession() {
  const root = document.getElementById('root');
  if (root) start(root);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startSession);
} else {
  startSession();
}
