/* Team leader's personal official records. */
OMS.pages.officials = {
  name: 'officials',
  title: 'My Officials',
  subtitle: 'Reusable personnel records',
  roles: ['team_leader'],
  async render(container) {
    const ui = OMS.ui;
    container.innerHTML = '';

    const head = ui.el('div', { class: 'between mb-2' }, [
      ui.el('div', {}, [
        ui.el('div', { class: 'section-title', text: 'Officials on file' }),
        ui.el('div', { class: 'section-sub', style: 'margin-bottom:0', text: 'These records can be reused when building rosters for future programs.' }),
      ]),
    ]);
    const add = ui.el('button', { class: 'btn btn-gold', text: '+ New official' });
    add.onclick = () => officialModal(null, reload);
    head.appendChild(add);
    container.appendChild(head);

    const searchBar = ui.el('div', { class: 'search-bar' }, [
      ui.el('input', { class: 'input', placeholder: 'Search officials by name, phone or role…' }),
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
          ui.el('p', { text: term ? 'Try a different search term.' : 'Add officials to reuse them across multiple programs.' }),
        ]));
        return;
      }

      const wrap = ui.el('div', { class: 'table-wrap' });
      const table = ui.el('table', { class: 'data' });
      table.appendChild(ui.el('thead', {}, [ui.el('tr', {}, [
        ui.el('th', { text: 'Official' }),
        ui.el('th', { text: 'KINGSCHAT Phone' }),
        ui.el('th', { text: 'Handle' }),
        ui.el('th', { text: 'Accommodation' }),
        ui.el('th', { text: 'HQ Staff' }),
        ui.el('th', { text: 'Added' }),
        ui.el('th', { text: 'Actions' }),
      ])]));
      const tbody = ui.el('tbody');
      rows.forEach(function (o) {
        const edit = ui.el('button', { class: 'btn btn-sm btn-outline', text: 'Edit' });
        edit.onclick = () => officialModal(o, reload);
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
          ui.el('td', { class: 'mono small', text: o.kingschat_phone }),
          ui.el('td', { class: 'mono small', text: o.kingschat_handle || '—' }),
          ui.el('td', { html: '<span class="badge ' + (Number(o.accommodation) ? 'approved' : 'draft') + '">' + (Number(o.accommodation) ? 'Yes' : 'No') + '</span>' }),
          ui.el('td', { html: '<span class="badge ' + (Number(o.hq_staff_member) ? 'approved' : 'draft') + '">' + (Number(o.hq_staff_member) ? 'Yes' : 'No') + '</span>' }),
          ui.el('td', { class: 'small muted', text: ui.fmtDate(o.created_at) }),
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

function officialModal(official, onDone) {
  const ui = OMS.ui;
  const isEdit = !!official;
  function f(label, node) { return ui.el('div', { class: 'field' }, [ui.el('label', { text: label }), node]); }

  const title = ui.titleSelect(official ? official.title : '');
  const first = ui.el('input', { class: 'input', value: official ? official.first_name : '', placeholder: 'First name' });
  const last = ui.el('input', { class: 'input', value: official ? official.last_name : '', placeholder: 'Last name' });
  const phone = ui.el('input', { class: 'input', value: official ? official.kingschat_phone : '', placeholder: '2348012345678' });
  const handle = ui.el('input', { class: 'input', value: official ? official.kingschat_handle : '', placeholder: 'e.g. @john.doe' });

  function yesNo(current) {
    const sel = ui.el('select', { class: 'select' });
    const val = Number(current) ? '1' : '0';
    [['0', 'No'], ['1', 'Yes']].forEach((opt) => sel.appendChild(ui.el('option', { value: opt[0], selected: opt[0] === val ? 'selected' : null, text: opt[1] })));
    return sel;
  }
  const accom = yesNo(official ? official.accommodation : 0);
  const hq = yesNo(official ? official.hq_staff_member : 0);

  const body = ui.el('div', {}, [
    ui.el('div', { class: 'field-row-3' }, [f('Title', title), f('First Name', first), f('Last Name', last)]),
    f('KINGSCHAT Phone Number (Pls include 234 in phone number)', phone),
    f('KINGSCHAT Handle', handle),
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
      if (isEdit) await OMS.api.put('/officials/' + official.id, payload);
      else await OMS.api.post('/officials', payload);
      ui.toast(isEdit ? 'Official updated.' : 'Official added.', 'ok');
      m.close(); onDone && onDone();
    } catch (e) { ui.toast(e.message, 'err'); save.disabled = false; }
  };
}
