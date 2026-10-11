/* Event detail — manager review view and team-leader roster view. */
OMS.pages.eventDetail = {
  name: 'eventDetail',
  title: 'Program',
  subtitle: 'Details & roster',
  async render(container, params) {
    const user = OMS.store.getUser();
    const event = await OMS.api.get('/events/' + params.id);
    if (user.role === 'team_leader') return renderLeaderDetail(container, event);
    return renderManagerDetail(container, event);
  },
};

/* ----------------------------- Manager view ----------------------------- */
function renderManagerDetail(container, event) {
  const ui = OMS.ui;
  container.innerHTML = '';

  container.appendChild(backLink('Back to programs', '#/events'));
  container.appendChild(eventHeader(event, true, function () {
    openEventModal(event, function () { OMS.pages.eventDetail.render(container, { id: event.id }); });
  }));

  const card = ui.el('div', { class: 'card mt-2' });
  card.appendChild(ui.el('div', { class: 'card-head' }, [
    ui.el('div', {}, [
      ui.el('h3', { text: 'Submitted rosters' }),
      ui.el('p', { text: 'Review each team leader\u2019s list and approve or request edits.' }),
    ]),
    exportBtn(event.id),
  ]));
  container.appendChild(card);

  loadSubmissions(card, event.id);
}

async function loadSubmissions(card, eventId) {
  const ui = OMS.ui;
  const old = card.querySelector('.table-wrap, .empty');
  if (old) old.remove();
  const loading = ui.el('div', { class: 'loading' }, [ui.el('span', { class: 'spinner' }), 'Loading rosters…']);
  card.appendChild(loading);

  let subs = [];
  try { subs = await OMS.api.get('/events/' + eventId + '/submissions'); }
  catch (e) { loading.remove(); ui.toast(e.message, 'err'); return; }
  loading.remove();

  if (!subs.length) {
    card.appendChild(ui.el('div', { class: 'empty' }, [
      ui.el('div', { class: 'big', text: '✎' }),
      ui.el('h4', { text: 'No submissions yet' }),
      ui.el('p', { text: 'Share the registration link with team leaders. Their rosters will appear here once submitted.' }),
    ]));
    return;
  }

  const wrap = ui.el('div', { class: 'table-wrap' });
  const table = ui.el('table', { class: 'data' });
  table.appendChild(ui.el('thead', {}, [ui.el('tr', {}, [
    ui.el('th', { text: 'Team leader' }),
    ui.el('th', { text: 'Officials' }),
    ui.el('th', { text: 'Status' }),
    ui.el('th', { text: 'Submitted' }),
    ui.el('th', { text: 'Actions' }),
  ])]));
  const tbody = ui.el('tbody');
  subs.forEach(function (s) {
    const tr = ui.el('tr', {}, [
      ui.el('td', {}, [
        ui.el('div', { style: 'font-weight:600;color:var(--navy-900)', text: (s.first_name + ' ' + s.last_name).trim() || s.username }),
        ui.el('div', { class: 'small muted', text: s.kingschat_phone || s.username }),
      ]),
      ui.el('td', {}, [
        ui.el('div', { text: String(s.official_count) }),
        Number(s.approved_count) > 0 ? ui.el('div', { class: 'small muted', text: s.approved_count + ' approved' }) : null,
      ]),
      ui.el('td', { html: ui.submissionBadge(s.status) }),
      ui.el('td', { class: 'small muted', text: s.submitted_at ? ui.fmtDateTime(s.submitted_at) : '—' }),
      ui.el('td', {}, [ui.el('div', { class: 'cell-actions' }, [
        reviewBtn(s),
      ])]),
    ]);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  card.appendChild(wrap);

  function reviewBtn(s) {
    const b = ui.el('button', { class: 'btn btn-sm btn-outline', text: 'Review' });
    b.onclick = () => openReviewModal(s, () => loadSubmissions(card, eventId));
    return b;
  }
}

async function openReviewModal(sub, onDone) {
  const ui = OMS.ui;
  let detail;
  try { detail = await OMS.api.get('/submissions/' + sub.id); }
  catch (e) { ui.toast(e.message, 'err'); return; }

  const body = ui.el('div', {});
  body.appendChild(ui.el('div', { class: 'between mb-2' }, [
    ui.el('div', {}, [
      ui.el('div', { style: 'font-weight:700;color:var(--navy-900)', text: (detail.first_name + ' ' + detail.last_name).trim() || detail.username }),
      ui.el('div', { class: 'small muted', text: detail.kingschat_phone || '' }),
    ]),
    ui.el('div', { html: ui.submissionBadge(detail.status) }),
  ]));

  if (detail.note) body.appendChild(ui.el('div', { class: 'alert info', text: 'Leader note: ' + detail.note }));
  if (detail.review_note) body.appendChild(ui.el('div', { class: 'alert warn', text: 'Your last note: ' + detail.review_note }));

  // Reflect existing approvals when the roster was already approved; otherwise
  // default every official to selected so "Approve" approves the whole roster.
  const sawFlags = detail.officials.some((o) => Number(o.approved) === 1);
  const reflect = detail.status === 'approved' && sawFlags;

  const checks = [];
  const selectAll = ui.el('input', { type: 'checkbox', style: 'width:16px;height:16px;accent-color:var(--navy-700)' });
  const countLabel = ui.el('span', { class: 'small muted' });
  const header = ui.el('div', { class: 'between', style: 'margin:6px 0 10px' }, [
    ui.el('div', { style: 'font-weight:600;color:var(--navy-900)', text: 'Officials (' + detail.officials.length + ')' }),
    detail.officials.length ? ui.el('label', { class: 'row', style: 'gap:7px;font-weight:600;color:var(--navy-900);font-size:13px;cursor:pointer' }, [selectAll, 'Select all']) : null,
  ]);
  body.appendChild(header);

  if (!detail.officials.length) {
    body.appendChild(ui.el('div', { class: 'small muted', text: 'No officials on this roster yet.' }));
  } else {
    body.appendChild(ui.el('div', { class: 'small muted', style: 'margin-bottom:8px', text: 'Uncheck any official you do not want to approve.' }));
    const list = ui.el('div', { class: 'list' });
    detail.officials.forEach(function (o) {
      const cb = ui.el('input', { type: 'checkbox', style: 'width:16px;height:16px;accent-color:var(--navy-700);flex:none' });
      cb.checked = reflect ? Number(o.approved) === 1 : true;
      cb.onchange = updateCount;
      checks.push({ id: Number(o.roster_id), input: cb });
      list.appendChild(ui.el('label', { class: 'list-item', style: 'cursor:pointer' }, [
        cb,
        ui.el('div', { class: 'avatar-sm', text: ui.initials(o.first_name, o.last_name) }),
        ui.el('div', { class: 'meta' }, [
          ui.el('b', { text: (o.title ? o.title + ' ' : '') + o.first_name + ' ' + o.last_name }),
          ui.el('span', { text: officialMeta(o) }),
        ]),
        Number(o.approved) === 1 ? ui.el('span', { class: 'badge approved', text: 'Approved' }) : null,
      ]));
    });
    body.appendChild(list);
    body.appendChild(ui.el('div', { style: 'margin-top:10px' }, [countLabel]));
  }

  const noteBox = ui.el('textarea', { class: 'input', placeholder: 'Optional note when requesting a reduction or edit…', style: 'margin-top:16px' });

  const approve = ui.el('button', { class: 'btn btn-gold', text: 'Approve' });
  const requestEdit = ui.el('button', { class: 'btn btn-danger', text: 'Request edits' });
  const close = ui.el('button', { class: 'btn btn-outline', text: 'Close' });

  const m = ui.modal({
    title: 'Review submission',
    wide: true,
    body: ui.el('div', {}, [body, ui.el('div', { class: 'field', style: 'margin-top:18px' }, [
      ui.el('label', { text: 'Note to team leader (for edit requests)' }), noteBox,
    ])]),
    footer: [close, requestEdit, approve],
  });
  close.onclick = () => m.close();

  function updateCount() {
    const n = checks.filter((c) => c.input.checked).length;
    countLabel.textContent = n + ' of ' + checks.length + ' selected';
    approve.textContent = 'Approve selected (' + n + ')';
    approve.disabled = n === 0;
    selectAll.checked = checks.length > 0 && n === checks.length;
    selectAll.indeterminate = n > 0 && n < checks.length;
  }
  selectAll.onchange = function () {
    checks.forEach(function (c) { c.input.checked = selectAll.checked; });
    updateCount();
  };
  if (checks.length) updateCount(); else approve.textContent = 'Approve roster';

  approve.onclick = async function () {
    const ids = checks.filter((c) => c.input.checked).map((c) => c.id);
    approve.disabled = true;
    try {
      const res = await OMS.api.post('/submissions/' + detail.id + '/approve', { roster_ids: ids });
      const n = res && res.approved_count != null ? res.approved_count : ids.length;
      ui.toast('Approved ' + n + ' official(s).', 'ok');
      m.close(); onDone && onDone();
    } catch (e) { ui.toast(e.message, 'err'); approve.disabled = false; }
  };
  requestEdit.onclick = async function () {
    if (!noteBox.value.trim()) { ui.toast('Please add a note describing the changes.', 'err'); return; }
    requestEdit.disabled = true;
    try {
      await OMS.api.post('/submissions/' + detail.id + '/request-revision', { note: noteBox.value.trim() });
      ui.toast('Edit request sent to the team leader.', 'ok');
      m.close(); onDone && onDone();
    } catch (e) { ui.toast(e.message, 'err'); requestEdit.disabled = false; }
  };
}

function exportBtn(eventId) {
  const ui = OMS.ui;
  const b = ui.el('button', { class: 'btn btn-outline btn-sm', text: '⭳ Export CSV' });
  b.onclick = function () {
    const token = OMS.api.getToken();
    fetch('/api/export/event/' + eventId, { headers: { Authorization: 'Bearer ' + token } })
      .then(function (r) {
        if (!r.ok) throw new Error('Export failed');
        return r.blob();
      })
      .then(function (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'roster.csv';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        ui.toast('CSV exported.', 'ok');
      })
      .catch((e) => ui.toast(e.message, 'err'));
  };
  return b;
}

/* --------------------------- Team leader view --------------------------- */
function renderLeaderDetail(container, event) {
  const ui = OMS.ui;
  container.innerHTML = '';

  container.appendChild(backLink('Back to my programs', '#/events'));
  container.appendChild(eventHeader(event, false));

  if (!event.is_participant) {
    container.appendChild(ui.el('div', { class: 'card card-pad mt-2' }, [
      ui.el('div', { class: 'alert info', style: 'margin:0', text: 'You are not registered for this program yet. Open it from the unique link your manager shared.' }),
    ]));
    return;
  }

  const status = event.submission ? event.submission.status : 'draft';
  const locked = status === 'submitted' || status === 'approved';

  container.appendChild(approvalPanel(event.submission));

  const card = ui.el('div', { class: 'card mt-2' });
  const head = ui.el('div', { class: 'card-head' }, [
    ui.el('div', {}, [
      ui.el('h3', { text: 'My officials roster' }),
      ui.el('p', { text: 'Select returning officials or add new personnel for this program.' }),
    ]),
    ui.el('div', { class: 'row' }, [
      ui.el('span', { html: ui.submissionBadge(status) }),
    ]),
  ]);
  card.appendChild(head);

  const toolbar = ui.el('div', { class: 'card-pad', style: 'padding-bottom:0' });
  const addExisting = ui.el('button', { class: 'btn btn-primary', text: '＋ Add from my officials' });
  const addNew = ui.el('button', { class: 'btn btn-outline', text: '＋ Add new official' });
  addExisting.disabled = locked || event.status === 'closed';
  addNew.disabled = locked || event.status === 'closed';
  toolbar.appendChild(ui.el('div', { class: 'row mb-2' }, [addExisting, addNew]));
  if (locked) toolbar.appendChild(ui.el('div', { class: 'small muted mb-2', text: 'This roster is ' + status + '. Ask the manager to reopen editing if changes are needed.' }));
  card.appendChild(toolbar);

  const listWrap = ui.el('div', { class: 'card-pad list' });
  card.appendChild(listWrap);
  container.appendChild(card);

  const submitRow = ui.el('div', { class: 'between mt-2' });
  submitRow.appendChild(ui.el('span', { class: 'small muted', text: 'Officials are saved instantly. Submit when your list is complete.' }));
  const submitBtn = ui.el('button', { class: 'btn btn-gold', text: 'Submit roster for approval' });
  submitBtn.disabled = locked || event.status === 'closed';
  submitRow.appendChild(submitBtn);
  container.appendChild(submitRow);

  let roster = [];

  async function load() {
    listWrap.innerHTML = '';
    listWrap.appendChild(ui.el('div', { class: 'loading' }, [ui.el('span', { class: 'spinner' }), 'Loading roster…']));
    try {
      const res = await OMS.api.get('/events/' + event.id + '/roster');
      roster = res.officials;
    } catch (e) { ui.toast(e.message, 'err'); roster = []; }
    listWrap.innerHTML = '';

    if (!roster.length) {
      listWrap.appendChild(ui.el('div', { class: 'empty', style: 'padding:30px 10px' }, [
        ui.el('div', { class: 'big', text: '☰' }),
        ui.el('h4', { text: 'No officials selected' }),
        ui.el('p', { text: 'Add officials from your records or create new ones to build your roster.' }),
      ]));
      return;
    }
    roster.forEach(function (o) {
      const remove = ui.el('button', { class: 'btn btn-sm btn-danger', text: 'Remove' });
      remove.disabled = locked || event.status === 'closed';
      remove.onclick = async function () {
        try {
          await OMS.api.del('/events/' + event.id + '/roster/' + o.id);
          ui.toast('Removed ' + o.first_name + '.', 'ok');
          load();
        } catch (e) { ui.toast(e.message, 'err'); }
      };
      listWrap.appendChild(ui.el('div', { class: 'list-item' }, [
        ui.el('div', { class: 'avatar-sm', text: ui.initials(o.first_name, o.last_name) }),
        ui.el('div', { class: 'meta' }, [
          ui.el('b', { text: (o.title ? o.title + ' ' : '') + o.first_name + ' ' + o.last_name }),
          ui.el('span', { text: officialMeta(o) }),
        ]),
        Number(o.approved) === 1
          ? ui.el('span', { class: 'badge approved', text: 'Approved' })
          : (status === 'approved' ? ui.el('span', { class: 'badge draft', text: 'Not approved' }) : null),
        remove,
      ]));
    });
  }

  addExisting.onclick = () => openExistingPicker(event, roster, load);
  addNew.onclick = () => openNewOfficialModal(event, load);
  submitBtn.onclick = async function () {
    if (!roster.length) { ui.toast('Add at least one official before submitting.', 'err'); return; }
    if (!(await ui.confirm('Submit your roster of ' + roster.length + ' official(s) for approval?', { okText: 'Submit' }))) return;
    submitBtn.disabled = true;
    try {
      await OMS.api.post('/events/' + event.id + '/submit', {});
      ui.toast('Roster submitted for approval.', 'ok');
      OMS.pages.eventDetail.render(container, { id: event.id });
    } catch (e) { ui.toast(e.message, 'err'); submitBtn.disabled = false; }
  };

  load();
}

/* Approval status panel shown to the team leader after submitting. */
function approvalPanel(sub) {
  const ui = OMS.ui;
  const status = sub ? sub.status : 'draft';
  const meta = {
    draft: { cls: 'info', title: 'Draft', msg: 'This roster has not been submitted for approval yet.' },
    submitted: { cls: 'info', title: 'Pending', msg: 'Submitted for approval — awaiting your Programs Manager.' },
    approved: { cls: 'ok', title: 'Approved', msg: 'Your roster has been approved.' },
    revision: { cls: 'warn', title: 'Edits requested', msg: 'Your Programs Manager requested changes to this roster.' },
  }[status] || { cls: 'info', title: ui.submissionLabel(status), msg: '' };

  if (status === 'approved' && sub && sub.official_count) {
    meta.msg = sub.approved_count + ' of ' + sub.official_count + ' official(s) approved.';
  }

  const card = ui.el('div', { class: 'card card-pad mt-2' });
  card.appendChild(ui.el('div', { class: 'between' }, [
    ui.el('div', {}, [
      ui.el('div', { style: 'font-weight:700;color:var(--navy-900)', text: 'Approval status' }),
      ui.el('div', { class: 'small muted', style: 'margin-top:3px', text: meta.msg }),
    ]),
    ui.el('span', { class: 'badge ' + (sub ? status : 'draft'), text: meta.title }),
  ]));

  const when = [];
  if (sub && sub.submitted_at) when.push('Submitted ' + ui.fmtDateTime(sub.submitted_at));
  if (sub && sub.reviewed_at) when.push('Reviewed ' + ui.fmtDateTime(sub.reviewed_at));
  if (when.length) {
    card.appendChild(ui.el('div', { class: 'small muted', style: 'margin-top:10px', text: when.join(' • ') }));
  }

  if (sub && sub.review_note) {
    card.appendChild(ui.el('div', { class: 'divider' }));
    card.appendChild(ui.el('div', { class: 'alert warn', style: 'margin:0' }, [
      ui.el('b', { text: 'Manager note: ' }),
      sub.review_note,
    ]));
  }
  if (sub && sub.note) {
    card.appendChild(ui.el('div', { class: 'divider' }));
    card.appendChild(ui.el('div', { class: 'alert info', style: 'margin:0' }, [
      ui.el('b', { text: 'Your note: ' }),
      sub.note,
    ]));
  }
  return card;
}

function openExistingPicker(event, roster, onDone) {
  const ui = OMS.ui;
  const selectedIds = roster.map((o) => o.id);
  const listWrap = ui.el('div', { class: 'list' });
  const note = ui.el('div', { class: 'small muted mb-2' });
  const search = ui.el('input', { class: 'input', placeholder: 'Search by name, phone or role…' });
  const body = ui.el('div', {}, [
    ui.el('div', { class: 'search-bar' }, [search]),
    note,
    listWrap,
  ]);

  const addBtn = ui.el('button', { class: 'btn btn-gold', text: 'Add selected' });
  const closeBtn = ui.el('button', { class: 'btn btn-outline', text: 'Close' });
  const m = ui.modal({ title: 'Select returning officials', wide: true, body: body, footer: [closeBtn, addBtn] });
  closeBtn.onclick = () => m.close();

  const selected = new Set();
  let all = [];

  function renderList(filter) {
    listWrap.innerHTML = '';
    const f = (filter || '').toLowerCase();
    const filtered = all.filter((o) =>
      !f || (o.first_name + ' ' + o.last_name + ' ' + o.kingschat_phone + ' ' + (o.kingschat_handle || '') + ' ' + (o.role || '')).toLowerCase().indexOf(f) !== -1);
    if (!filtered.length) {
      listWrap.appendChild(ui.el('div', { class: 'empty', style: 'padding:30px 10px' }, [
        ui.el('p', { text: all.length ? 'No officials match your search.' : 'You have no saved officials yet. Add a new official instead.' }),
      ]));
      updateNote();
      return;
    }
    filtered.forEach(function (o) {
      const already = selectedIds.indexOf(o.id) !== -1;
      const cb = ui.el('input', { type: 'checkbox' });
      cb.checked = already ? true : selected.has(o.id);
      cb.disabled = already;
      const row = ui.el('label', { class: 'check-row' + (already ? ' checked' : '') }, [
        cb,
        ui.el('div', { class: 'info' }, [
          ui.el('b', { text: (o.title ? o.title + ' ' : '') + o.first_name + ' ' + o.last_name }),
          ui.el('span', { text: officialMeta(o) + (already ? ' • already added' : '') }),
        ]),
      ]);
      cb.onchange = function () {
        if (cb.checked) selected.add(o.id); else selected.delete(o.id);
        row.classList.toggle('checked', cb.checked);
        updateNote();
      };
      listWrap.appendChild(row);
    });
    updateNote();
  }

  function updateNote() {
    note.textContent = selected.size + ' selected';
    addBtn.disabled = selected.size === 0;
  }

  search.oninput = () => renderList(search.value);

  OMS.api.get('/officials').then(function (rows) {
    all = rows;
    renderList('');
  }).catch((e) => { listWrap.innerHTML = ''; listWrap.appendChild(ui.el('div', { class: 'alert err', text: e.message })); });

  addBtn.onclick = async function () {
    addBtn.disabled = true;
    let added = 0, failed = 0;
    for (const id of Array.from(selected)) {
      try { await OMS.api.post('/events/' + event.id + '/roster', { official_id: id }); added++; }
      catch (e) { failed++; }
    }
    ui.toast(added + ' official(s) added' + (failed ? ', ' + failed + ' skipped' : '') + '.', 'ok');
    m.close();
    onDone && onDone();
  };
}

function openNewOfficialModal(event, onDone) {
  const ui = OMS.ui;
  function f(label, node) { return ui.el('div', { class: 'field' }, [ui.el('label', { text: label }), node]); }
  const title = ui.titleSelect('');
  const first = ui.el('input', { class: 'input', placeholder: 'First name' });
  const last = ui.el('input', { class: 'input', placeholder: 'Last name' });
  const phone = ui.el('input', { class: 'input', placeholder: '2348012345678' });
  const handle = ui.el('input', { class: 'input', placeholder: 'e.g. @john.doe' });

  function yesNo() {
    const sel = ui.el('select', { class: 'select' });
    sel.appendChild(ui.el('option', { value: '0', text: 'No' }));
    sel.appendChild(ui.el('option', { value: '1', text: 'Yes' }));
    return sel;
  }
  const accom = yesNo();
  const hq = yesNo();

  const body = ui.el('div', {}, [
    ui.el('div', { class: 'alert info', text: 'This official is saved to your records and added to the roster.' }),
    ui.el('div', { class: 'field-row-3' }, [f('Title', title), f('First Name', first), f('Last Name', last)]),
    f('KINGSCHAT Phone Number (Pls include 234 in phone number)', phone),
    f('KINGSCHAT Handle', handle),
    ui.el('div', { class: 'field-row' }, [
      f('ACCOMODATION YES/NO (Subject to Approval)', accom),
      f('HQ Staff Member (YES/NO)', hq),
    ]),
  ]);

  const save = ui.el('button', { class: 'btn btn-gold', text: 'Add official' });
  const cancel = ui.el('button', { class: 'btn btn-outline', text: 'Cancel' });
  const m = ui.modal({ title: 'Add a new official', body: body, footer: [cancel, save] });
  cancel.onclick = () => m.close();

  save.onclick = async function () {
    const payload = {
      title: title.value.trim(), first_name: first.value.trim(), last_name: last.value.trim(),
      kingschat_phone: phone.value.trim(), kingschat_handle: handle.value.trim(),
      accommodation: parseInt(accom.value, 10), hq_staff_member: parseInt(hq.value, 10),
    };
    if (!payload.first_name || !payload.last_name || !payload.kingschat_phone) {
      ui.toast('First name, last name and phone are required.', 'err'); return;
    }
    if (!/^234\d{7,}$/.test(payload.kingschat_phone.replace(/\s+/g, ''))) {
      ui.toast('KingsChat phone must start with 234.', 'err'); return;
    }
    save.disabled = true;
    try {
      await OMS.api.post('/events/' + event.id + '/roster', payload);
      ui.toast('Official added to roster.', 'ok');
      m.close(); onDone && onDone();
    } catch (e) { ui.toast(e.message, 'err'); save.disabled = false; }
  };
}

/* ------------------------------- Shared --------------------------------- */
function officialMeta(o) {
  const parts = [];
  if (o.kingschat_handle) parts.push(o.kingschat_handle);
  parts.push(o.kingschat_phone);
  parts.push('Accommodation: ' + (Number(o.accommodation) ? 'Yes' : 'No'));
  parts.push('HQ Staff: ' + (Number(o.hq_staff_member) ? 'Yes' : 'No'));
  return parts.join(' • ');
}

function eventHeader(event, manager, onEdit) {
  const ui = OMS.ui;
  const card = ui.el('div', { class: 'card card-pad' });
  card.appendChild(ui.el('div', { class: 'between' }, [
    ui.el('div', {}, [
      ui.el('h2', { style: 'font-size:22px;color:var(--navy-900)', text: event.name }),
      ui.el('div', { class: 'row mt-1' }, [
        ui.el('span', { html: '<span class="badge ' + ui.esc(event.status) + '">' + ui.esc(event.status) + '</span>' }),
        event.expected_count ? ui.el('span', { class: 'badge gold', text: 'Expected ' + event.expected_count + ' / team' }) : null,
      ]),
    ]),
    manager ? editLink(event, onEdit) : null,
  ]));
  if (event.description) card.appendChild(ui.el('p', { class: 'muted', style: 'margin-top:14px;line-height:1.6;font-size:14px', text: event.description }));
  card.appendChild(ui.el('div', { class: 'divider' }));
  card.appendChild(ui.el('div', { class: 'detail-list' }, [
    detail('Venue', event.venue || '—'),
    detail('Date', ui.fmtDate(event.event_date)),
    detail('Time', (event.start_time || '—') + (event.end_time ? ' – ' + event.end_time : '')),
    detail('Officials registered', (event.registered_count || 0) + (event.expected_count ? ' of ' + (event.expected_count * Math.max(event.team_count || 1, 1)) + ' expected' : '')),
  ]));
  if (manager) {
    card.appendChild(ui.el('div', { class: 'divider' }));
    card.appendChild(ui.el('div', { class: 'small', style: 'font-weight:600;color:var(--navy-800)', text: 'Registration link for team leaders' }));
    const input = ui.el('input', { class: 'input mono', readonly: 'readonly' });
    input.value = location.origin + location.pathname + '#/join/' + event.token;
    const copy = ui.el('button', { class: 'btn btn-outline', text: 'Copy' });
    copy.onclick = function () {
      input.select();
      navigator.clipboard.writeText(input.value).then(
        () => ui.toast('Link copied.', 'ok'),
        () => { document.execCommand('copy'); ui.toast('Link copied.', 'ok'); });
    };
    card.appendChild(ui.el('div', { class: 'copy-field mt-1' }, [input, copy]));
  }
  return card;

  function detail(k, v) { return ui.el('div', {}, [ui.el('div', { class: 'k', text: k }), ui.el('div', { class: 'v', text: v })]); }
  function editLink(ev, cb) {
    const b = ui.el('button', { class: 'btn btn-outline btn-sm', text: '✎ Edit program' });
    b.onclick = () => { if (onEdit) onEdit(); };
    return b;
  }
}

function backLink(text, href) {
  const ui = OMS.ui;
  const a = ui.el('a', { href: href, class: 'small', style: 'font-weight:600;display:inline-block;margin-bottom:14px', text: '← ' + text });
  return a;
}
