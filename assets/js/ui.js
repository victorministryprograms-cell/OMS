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
        title: opts.title || 'Please confirm',
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
    submitted: 'Pending approval',
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

  return { esc: esc, html: html, el: el, toast: toast, modal: modal, confirm: confirm,
           initials: initials, fmtDate: fmtDate, fmtDateTime: fmtDateTime,
           roleLabel: roleLabel, statusBadge: statusBadge, titleSelect: titleSelect,
           submissionLabel: submissionLabel, submissionBadge: submissionBadge };
})();
