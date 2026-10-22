/* UI helpers: DOM building, toasts, modals, formatting. */
window.OMS = window.OMS || {};

OMS.ui = (function () {
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function html(strings) {
    const tpl = document.createElement('template');
    tpl.innerHTML = strings.join('').trim();
    return tpl.content.firstElementChild;
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function toast(message, kind) {
    const root = document.getElementById('toast-root');
    const t = el('div', { class: 'toast ' + (kind || '') }, [
      el('span', { class: 'ico', text: kind === 'err' ? '⚠' : kind === 'ok' ? '✓' : 'ℹ' }),
      el('span', { text: message }),
    ]);
    root.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .25s, transform .25s';
      t.style.opacity = '0';
      t.style.transform = 'translateX(30px)';
      setTimeout(() => t.remove(), 250);
    }, 3200);
  }

  function modal(opts) {
    const root = document.getElementById('modal-root');
    const overlay = el('div', { class: 'modal-overlay' });
    const box = el('div', { class: 'modal' + (opts.wide ? ' wide' : '') });

    const head = el('div', { class: 'modal-head' }, [
      el('h3', { text: opts.title || '' }),
      el('button', { class: 'x', html: '&times;', onclick: close }),
    ]);
    const bodyNode = el('div', { class: 'modal-body' });
    if (typeof opts.body === 'string') bodyNode.innerHTML = opts.body;
    else if (opts.body) bodyNode.appendChild(opts.body);

    box.appendChild(head);
    box.appendChild(bodyNode);
    if (opts.footer) {
      const foot = el('div', { class: 'modal-foot' });
      opts.footer.forEach((f) => foot.appendChild(f));
      box.appendChild(foot);
    }
    overlay.appendChild(box);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    root.appendChild(overlay);

    function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    return { close: close, body: bodyNode, overlay: overlay };
  }

  function confirm(message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      const okBtn = el('button', { class: 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary'), text: opts.okText || 'Confirm' });
      const cancel = el('button', { class: 'btn btn-outline', text: 'Cancel' });
      const m = modal({
        title: opts.title || 'Confirm',
        body: el('p', { class: 'small', style: 'line-height:1.6;margin:0;color:#4a5568', text: message }),
        footer: [cancel, okBtn],
      });
      cancel.onclick = function () { m.close(); resolve(false); };
      okBtn.onclick = function () { m.close(); resolve(true); };
    });
  }

  function initials(first, last) {
    return ((first || '').charAt(0) + (last || '').charAt(0)).toUpperCase() || '?';
  }

  function fmtDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d)) return value;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function fmtDateTime(value) {
    if (!value) return '—';
    const d = new Date(value.replace(' ', 'T') + (value.length === 10 ? '' : 'Z'));
    if (isNaN(d)) return value;
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function roleLabel(role) {
    return { super_admin: 'Super User', programs_manager: 'Programs Manager', team_leader: 'Team Leader' }[role] || role;
  }

  function statusBadge(status) {
    return '<span class="badge ' + esc(status) + '">' + esc((status || '').replace('_', ' ')) + '</span>';
  }

  const SUBMISSION_LABELS = {
    draft: 'Draft',
    submitted: 'Pending',
    approved: 'Approved',
    revision: 'Edits requested',
  };

  function submissionLabel(status) {
    return SUBMISSION_LABELS[status] || status || 'Draft';
  }

  function submissionBadge(status) {
    const s = status || 'draft';
    return '<span class="badge ' + esc(s) + '">' + esc(submissionLabel(s)) + '</span>';
  }

  function teamSelect(teams, current) {
    const sel = el('select', { class: 'select' });
    sel.appendChild(el('option', { value: '', text: 'No team' }));
    (teams || []).forEach(function (t) {
      sel.appendChild(el('option', { value: String(t.id), text: t.name }));
    });
    if (current) sel.value = String(current);
    return sel;
  }

  async function fetchTeams() {
    try { return await OMS.api.get('/teams'); } catch (e) { return []; }
  }

  const OFFICIAL_TITLES = ['Brother', 'Sister', 'Pastor', 'Deacon', 'Deaconess'];

  function titleSelect(current) {
    const sel = el('select', { class: 'select' });
    const val = current || '';
    sel.appendChild(el('option', { value: '', text: 'Select title' }));
    const list = (val && OFFICIAL_TITLES.indexOf(val) === -1) ? [val].concat(OFFICIAL_TITLES) : OFFICIAL_TITLES;
    list.forEach(function (t) {
      sel.appendChild(el('option', { value: t, text: t }));
    });
    sel.value = val;
    return sel;
  }

  const EYE = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M17.9 17.9A10.4 10.4 0 0 1 12 19.5C5.4 19.5 2 12.5 2 12.5a18.6 18.6 0 0 1 5.1-5.6M9.9 4.6A9.6 9.6 0 0 1 12 4.5c6.6 0 10 7 10 7a18.7 18.7 0 0 1-2.2 3.3"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/><line x1="2.5" y1="2.5" x2="21.5" y2="21.5"/></svg>';

  /* Password input with an eye button that shows/hides the value.
     Returns { input, wrap } - append `wrap` to the DOM, read `input.value`. */
  function passwordInput(opts) {
    const attrs = Object.assign({ class: 'input', type: 'password', autocomplete: 'off' }, opts || {});
    const input = el('input', attrs);
    const toggle = el('button', {
      class: 'pw-toggle',
      type: 'button',
      title: 'Show password',
      'aria-label': 'Show password',
      'aria-pressed': 'false',
      html: EYE,
    });
    const wrap = el('div', { class: 'pw-wrap' }, [input, toggle]);

    toggle.onclick = function () {
      const revealed = input.type === 'password';
      input.type = revealed ? 'text' : 'password';
      toggle.innerHTML = revealed ? EYE_OFF : EYE;
      toggle.title = revealed ? 'Hide password' : 'Show password';
      toggle.setAttribute('aria-label', revealed ? 'Hide password' : 'Show password');
      toggle.setAttribute('aria-pressed', revealed ? 'true' : 'false');
      input.focus();
      const end = input.value.length;
      try { input.setSelectionRange(end, end); } catch (e) { /* older browsers */ }
    };

    return { input: input, wrap: wrap, toggle: toggle };
  }

  return { esc: esc, html: html, el: el, toast: toast, modal: modal, confirm: confirm,
           initials: initials, fmtDate: fmtDate, fmtDateTime: fmtDateTime,
           roleLabel: roleLabel, statusBadge: statusBadge, titleSelect: titleSelect,
           teamSelect: teamSelect, fetchTeams: fetchTeams,
           submissionLabel: submissionLabel, submissionBadge: submissionBadge,
           passwordInput: passwordInput };
})();
