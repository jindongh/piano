// Simple hash-based router
const routes = {};
let currentRoute = null;

export function registerRoute(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  window.location.hash = path;
}

export function getCurrentRoute() {
  return currentRoute;
}

function handleRouteChange() {
  const hash = window.location.hash.slice(1) || '/';
  currentRoute = hash;
  const content = document.getElementById('main-content');
  if (!content) return;

  const handler = routes[hash] || routes['/'];
  if (handler) {
    content.innerHTML = '';
    handler(content);
  }

  // Update nav active state
  document.querySelectorAll('.nav-link').forEach(link => {
    const linkPath = link.dataset.path;
    link.classList.toggle('active', linkPath === hash);
  });
}

export function initRouter() {
  window.addEventListener('hashchange', handleRouteChange);
  handleRouteChange();
}
