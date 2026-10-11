/* Minimal hash router. */
window.OMS = window.OMS || {};

OMS.router = (function () {
  const routes = [];

  function on(pattern, handler) {
    routes.push({ parts: pattern.split('/').filter(Boolean), handler: handler });
  }

  function resolve(path) {
    const parts = path.split('/').filter(Boolean);
    for (let i = 0; i < routes.length; i++) {
      const r = routes[i];
      if (r.parts.length !== parts.length) continue;
      const params = {};
      let match = true;
      for (let j = 0; j < r.parts.length; j++) {
        const pat = r.parts[j];
        if (pat.charAt(0) === ':') params[pat.slice(1)] = decodeURIComponent(parts[j]);
        else if (pat !== parts[j]) { match = false; break; }
      }
      if (match) return { handler: r.handler, params: params };
    }
    return null;
  }

  function currentPath() {
    const hash = location.hash || '#/';
    return hash.replace(/^#/, '') || '/';
  }

  return { on: on, resolve: resolve, currentPath: currentPath };
})();
