/* API client — wraps fetch with JWT auth and consistent error handling. */
window.OMS = window.OMS || {};
OMS.pages = OMS.pages || {};

OMS.api = (function () {
  const TOKEN_KEY = 'oms_token';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }
  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  async function request(method, path, body, opts) {
    opts = opts || {};
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    let res;
    try {
      res = await fetch('/api' + path, {
        method: method,
        headers: headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new Error('Cannot reach the server. Is it running?');
    }

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }

    if (!res.ok || (data && data.ok === false)) {
      const err = new Error((data && data.error) || ('Request failed (' + res.status + ')'));
      err.status = res.status;
      if (res.status === 401 && !opts.silent) OMS.store.onUnauthorized();
      throw err;
    }
    return data ? data.data : null;
  }

  return {
    getToken: getToken,
    setToken: setToken,
    get: (p, o) => request('GET', p, undefined, o),
    post: (p, b, o) => request('POST', p, b || {}, o),
    put: (p, b, o) => request('PUT', p, b || {}, o),
    del: (p, o) => request('DELETE', p, undefined, o),
    request: request,
  };
})();
