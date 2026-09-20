// PianoMaster — Main Entry Point
import './style.css';
import { registerRoute, initRouter, navigate } from './utils/router.js';
import { midiEngine } from './engine/midi-engine.js';
import { renderHome } from './pages/home.js';
import { renderImport } from './pages/import.js';
import { renderPractice, cleanupPractice } from './pages/practice.js';
import { renderResults } from './pages/results.js';

// Global app state
window.__pianoApp = {
  currentScore: null,
  lastResult: null,
  lastScore: null,
  _practiceCleanup: null
};

// Setup navigation
function renderNav() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;

  nav.innerHTML = `
    <div class="nav-logo" id="nav-logo">
      <span class="logo-icon">🎹</span>
      <span class="logo-text">PianoMaster</span>
    </div>
    <div class="nav-links">
      <button class="nav-link" data-path="/">首页</button>
      <button class="nav-link" data-path="/import">导入乐谱</button>
      <button class="nav-link" data-path="/practice">练习</button>
      <button class="nav-link" data-path="/results">评分</button>
    </div>
    <div class="nav-status">
      <div class="midi-status" id="midi-status">
        <span class="dot"></span>
        <span id="midi-status-text">未连接</span>
      </div>
    </div>
  `;

  // Nav click handlers
  document.getElementById('nav-logo')?.addEventListener('click', () => navigate('/'));
  nav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      const path = link.dataset.path;
      if (path) navigate(path);
    });
  });
}

// MIDI status updates
function updateMidiStatus() {
  const statusEl = document.getElementById('midi-status');
  const textEl = document.getElementById('midi-status-text');
  if (!statusEl || !textEl) return;

  if (midiEngine.isConnected()) {
    statusEl.classList.add('connected');
    textEl.textContent = midiEngine.getDeviceName() || 'MIDI 已连接';
  } else {
    statusEl.classList.remove('connected');
    textEl.textContent = '未连接';
  }
}

// Route handlers with cleanup
let previousRoute = null;

function withCleanup(renderFn) {
  return (container) => {
    // Cleanup previous page if needed
    if (previousRoute === '/practice') {
      cleanupPractice();
    }
    previousRoute = window.location.hash.slice(1) || '/';
    renderFn(container);
  };
}

// Register routes
registerRoute('/', withCleanup(renderHome));
registerRoute('/import', withCleanup(renderImport));
registerRoute('/practice', withCleanup(renderPractice));
registerRoute('/results', withCleanup(renderResults));

// Initialize
async function init() {
  renderNav();

  // Initialize MIDI
  await midiEngine.init();
  updateMidiStatus();

  midiEngine.on('connect', () => updateMidiStatus());
  midiEngine.on('disconnect', () => updateMidiStatus());

  // Start router
  initRouter();
}

init();
