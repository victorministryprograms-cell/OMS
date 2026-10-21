/* Team leader's personal official records. */
OMS.pages.officials = {
  name: 'officials',
  title: 'My Officials',
  subtitle: 'Saved officials',
  roles: ['team_leader'],
  async render(container) {
    const ui = OMS.ui;
    container.innerHTML = '';

    const head = ui.el('div', { class: 'between mb-2' }, [
      ui.el('div', {}, [
        ui.el('div', { class: 'section-title', text: 'Officials on file' }),
        ui.el('div', { class: 'section-sub', style: 'margin-bottom:0', text: 'Reuse these officials when building future rosters.' }),
      ]),
    ]);
    const actions = ui.el('div', { class: 'row' });
    const templateBtn = ui.el('button', { class: 'btn btn-outline', text: '⭳ Excel template' });
    const bulkBtn = ui.el('button', { class: 'btn btn-outline', text: '⭱ Bulk upload' });
    const add = ui.el('button', { class: 'btn btn-gold', text: '+ New official' });
    templateBtn.onclick = downloadTemplate;
    bulkBtn.onclick = () => bulkUploadModal(reload);
    add.onclick = async () => {
      const teams = await ui.fetchTeams();
      officialModal(null, reload, teams, (OMS.store.getUser() || {}).team_id);
    };
    actions.appendChild(templateBtn);
    actions.appendChild(bulkBtn);
    actions.appendChild(add);
    head.appendChild(actions);
    container.appendChild(head);

    const searchBar = ui.el('div', { class: 'search-bar' }, [
      ui.el('input', { class: 'input', placeholder: 'Search by name, phone or email' }),
    ]);
    container.appendChild(searchBar);
    const card = ui.el('div', { class: 'card' });
    container.appendChild(card);

    const searchInput = searchBar.querySelector('input');
    let timer = null;
    searchInput.oninput = function () {
      clearTimeout(timer);
      timer = setTimeout(() => load(searchInput.value), 250);
    };

    async function reload() { load(searchInput.value); }

    async function load(term) {
      card.innerHTML = '';
      card.appendChild(ui.el('div', { class: 'loading' }, [ui.el('span', { class: 'spinner' }), 'Loading officials…']));
      let rows = [];
      try { rows = await OMS.api.get('/officials' + (term ? '?search=' + encodeURIComponent(term) : '')); }
      catch (e) { card.innerHTML = ''; card.appendChild(ui.el('div', { class: 'alert err', text: e.message })); return; }
      card.innerHTML = '';

      if (!rows.length) {
        card.appendChild(ui.el('div', { class: 'empty' }, [
          ui.el('div', { class: 'big', text: '☰' }),
          ui.el('h4', { text: term ? 'No matches' : 'No officials yet' }),
          ui.el('p', { text: term ? 'Try a different search term.' : 'Add officials one by one, or bulk upload with the Excel template.' }),
        ]));
        return;
      }

      const wrap = ui.el('div', { class: 'table-wrap' });
      const table = ui.el('table', { class: 'data' });
      table.appendChild(ui.el('thead', {}, [ui.el('tr', {}, [
        ui.el('th', { text: 'Official' }),
        ui.el('th', { text: 'KingsChat Username' }),
        ui.el('th', { text: 'Email' }),
        ui.el('th', { text: 'Team' }),
        ui.el('th', { text: 'Phone Number' }),
        ui.el('th', { text: 'Accommodation' }),
        ui.el('th', { text: 'HQ Staff' }),
        ui.el('th', { text: 'Actions' }),
      ])]));
      const tbody = ui.el('tbody');
      rows.forEach(function (o) {
        const edit = ui.el('button', { class: 'btn btn-sm btn-outline', text: 'Edit' });
        edit.onclick = async () => {
          const teams = await ui.fetchTeams();
          officialModal(o, reload, teams);
        };
        const del = ui.el('button', { class: 'btn btn-sm btn-danger', text: 'Delete' });
        del.onclick = async function () {
          if (!(await ui.confirm('Delete ' + o.first_name + ' ' + o.last_name + ' from your records?', { danger: true, okText: 'Delete' }))) return;
          try { await OMS.api.del('/officials/' + o.id); ui.toast('Official removed.', 'ok'); reload(); }
          catch (e) { ui.toast(e.message, 'err'); }
        };
        tbody.appendChild(ui.el('tr', {}, [
          ui.el('td', {}, [
            ui.el('div', { style: 'font-weight:600;color:var(--navy-900)', text: (o.title ? o.title + ' ' : '') + o.first_name + ' ' + o.last_name }),
          ]),
          ui.el('td', { class: 'mono small', text: o.kingschat_handle || '—' }),
          ui.el('td', { class: 'small', text: o.email || '—' }),
          ui.el('td', { text: o.team_name || '—' }),
          ui.el('td', { class: 'mono small', text: o.kingschat_phone }),
          ui.el('td', { html: '<span class="badge ' + (Number(o.accommodation) ? 'approved' : 'draft') + '">' + (Number(o.accommodation) ? 'Yes' : 'No') + '</span>' }),
          ui.el('td', { html: '<span class="badge ' + (Number(o.hq_staff_member) ? 'approved' : 'draft') + '">' + (Number(o.hq_staff_member) ? 'Yes' : 'No') + '</span>' }),
          ui.el('td', {}, [ui.el('div', { class: 'cell-actions' }, [edit, del])]),
        ]));
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      card.appendChild(wrap);
    }

    load('');
  },
};

/* Downloads the Excel template used for bulk upload. */
function downloadTemplate() {
  const ui = OMS.ui;
  const token = OMS.api.getToken();
  fetch('/api/officials/template', { headers: { Authorization: 'Bearer ' + token } })
    .then(function (r) {
      if (!r.ok) throw new Error('Could not download the template.');
      return r.blob();
    })
    .then(function (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'officials_template.xlsx';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      ui.toast('Template downloaded.', 'ok');
    })
    .catch((e) => ui.toast(e.message, 'err'));
}

/* Bulk upload of officials from an Excel/CSV file. */
function bulkUploadModal(onDone) {
  const ui = OMS.ui;
  const fileInput = ui.el('input', { class: 'input', type: 'file', accept: '.xlsx,.csv' });
  const result = ui.el('div', { style: 'margin-top:12px' });

  const body = ui.el('div', {}, [
    ui.el('div', { class: 'alert info' }, [
      'Download the Excel template, fill one official per row, then upload it here. ',
      'Columns: Title, First Name, Last Name, KingsChat Username, Email Address, Team, Phone Number, Accommodation, HQ Staff Member.',
    ]),
    ui.el('div', { class: 'row mb-2' }, [
      ui.el('button', { class: 'btn btn-outline btn-sm', text: '⭳ Download Excel template', onclick: downloadTemplate }),
    ]),
    ui.el('div', { class: 'field' }, [ui.el('label', { text: 'Excel / CSV file' }), fileInput]),
    ui.el('div', { class: 'hint', text: 'Phone numbers start with 234. Officials are added to your team.' }),
    result,
  ]);

  const upload = ui.el('button', { class: 'btn btn-gold', text: 'Upload & add officials' });
  const closeBtn = ui.el('button', { class: 'btn btn-outline', text: 'Close' });
  const m = ui.modal({ title: 'Bulk upload officials', wide: true, body: body, footer: [closeBtn, upload] });
  closeBtn.onclick = () => m.close();

  upload.onclick = async function () {
    const file = fileInput.files && fileInput.files[0];
    if (!file) { ui.toast('Choose a file first.', 'err'); return; }
    upload.disabled = true;
    result.innerHTML = '';
    result.appendChild(ui.el('div', { class: 'loading' }, [ui.el('span', { class: 'spinner' }), 'Uploading…']));

    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/officials/bulk', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + OMS.api.getToken() },
        body: form,
      });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
      if (!res.ok || !data || data.ok === false) {
        throw new Error((data && data.error) || 'Upload failed.');
      }
      showResult(data.data, result, ui);
      // A clean import reloads the whole page so the refreshed list is shown.
      if (data.data.added > 0 && !data.data.skipped) {
        m.close();
        ui.toast(data.data.added + ' official(s) added.', 'ok');
        setTimeout(function () { location.reload(); }, 700);
        return;
      }
      upload.disabled = false;
      onDone && onDone();
    } catch (e) {
      result.innerHTML = '';
      result.appendChild(ui.el('div', { class: 'alert err', text: e.message }));
      upload.disabled = false;
    }
  };
}

function showResult(summary, result, ui) {
  result.innerHTML = '';
  result.appendChild(ui.el('div', { class: 'alert ' + (summary.added ? 'ok' : 'warn') }, [
    summary.added + ' official(s) added' + (summary.skipped ? ', ' + summary.skipped + ' skipped.' : '.'),
  ]));
  if (summary.errors && summary.errors.length) {
    const list = ui.el('div', { class: 'list' });
    summary.errors.forEach(function (err) {
      list.appendChild(ui.el('div', { class: 'list-item' }, [
        ui.el('div', { class: 'meta' }, [
          ui.el('b', { text: 'Row ' + err.row }),
          ui.el('span', { text: err.message }),
        ]),
      ]));
    });
    result.appendChild(ui.el('div', { class: 'small', style: 'font-weight:600;margin:10px 0 6px;color:var(--navy-900)', text: 'Rows that were skipped' }));
    result.appendChild(list);
  }
}

function officialModal(official, onDone, teams, defaultTeamId) {
  const ui = OMS.ui;
  const isEdit = !!official;
  function f(label, node) { return ui.el('div', { class: 'field' }, [ui.el('label', { text: label }), node]); }

  const title = ui.titleSelect(official ? official.title : '');
  const first = ui.el('input', { class: 'input', value: official ? official.first_name : '', placeholder: 'First name' });
  const last = ui.el('input', { class: 'input', value: official ? official.last_name : '', placeholder: 'Last name' });
  const phone = ui.el('input', { class: 'input', value: official ? official.kingschat_phone : '', placeholder: '2348012345678' });
  const handle = ui.el('input', { class: 'input', value: official ? official.kingschat_handle : '', placeholder: 'e.g. @john.doe' });
  const email = ui.el('input', { class: 'input', type: 'email', value: official ? (official.email || '') : '', placeholder: 'name@example.com' });
  const team = ui.teamSelect(teams, official ? official.team_id : defaultTeamId);

  function yesNo(current) {
    const sel = ui.el('select', { class: 'select' });
    const val = Number(current) ? '1' : '0';
    [['0', 'No'], ['1', 'Yes']].forEach((opt) => sel.appendChild(ui.el('option', { value: opt[0], selected: opt[0] === val ? 'selected' : null, text: opt[1] })));
    return sel;
  }
  const accom = yesNo(official ? official.accommodation : 0);
  const hq = yesNo(official ? official.hq_staff_member : 0);

  const body = ui.el('div', {}, [
    ui.el('div', { class: 'field-row' }, [f('First Name', first), f('Last Name', last)]),
    f('KingsChat Username', handle),
    ui.el('div', { class: 'field-row' }, [f('Email Address', email), f('Team', team)]),
    f('Phone Number (include 234)', phone),
    f('Title', title),
    ui.el('div', { class: 'field-row' }, [
      f('ACCOMODATION YES/NO (Subject to Approval)', accom),
      f('HQ Staff Member (YES/NO)', hq),
    ]),
  ]);

  const save = ui.el('button', { class: 'btn btn-gold', text: isEdit ? 'Save changes' : 'Add official' });
  const cancel = ui.el('button', { class: 'btn btn-outline', text: 'Cancel' });
  const m = ui.modal({ title: isEdit ? 'Edit official' : 'New official', body: body, footer: [cancel, save] });
  cancel.onclick = () => m.close();

  save.onclick = async function () {
    const payload = {
      title: title.value.trim(), first_name: first.value.trim(), last_name: last.value.trim(),
      kingschat_phone: phone.value.trim(), kingschat_handle: handle.value.trim(),
      email: email.value.trim(), team_id: team.value ? parseInt(team.value, 10) : null,
      accommodation: parseInt(accom.value, 10), hq_staff_member: parseInt(hq.value, 10),
    };
    if (!payload.first_name || !payload.last_name || !payload.kingschat_phone) {
      ui.toast('First name, last name and phone are required.', 'err'); return;
    }
    if (!/^234\d{7,}$/.test(payload.kingschat_phone.replace(/\s+/g, ''))) {
      ui.toast('KingsChat phone must start with 234.', 'err'); return;
    }
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      ui.toast('Enter a valid email address.', 'err'); return;
    }
    save.disabled = true;
    try {
      if (isEdit) await OMS.api.put('/officials/' + official.id, payload);
      else await OMS.api.post('/officials', payload);
      ui.toast(isEdit ? 'Official updated.' : 'Official added.', 'ok');
      m.close(); onDone && onDone();
    } catch (e) { ui.toast(e.message, 'err'); save.disabled = false; }
  };
}
