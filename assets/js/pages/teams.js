/* Super Admin — team management. */
OMS.pages.teams = {
  name: 'teams',
  title: 'Teams',
  subtitle: 'Groups for leaders and officials',
  roles: ['super_admin'],
  async render(container) {
    const ui = OMS.ui;
    container.innerHTML = '';

    const head = ui.el('div', { class: 'between mb-2' }, [
      ui.el('div', {}, [
        ui.el('div', { class: 'section-title', text: 'All teams' }),
        ui.el('div', { class: 'section-sub', style: 'margin-bottom:0', text: 'Team leaders and officials belong to a team.' }),
      ]),
    ]);
    const add = ui.el('button', { class: 'btn btn-gold', text: '+ New team' });
    add.onclick = () => teamModal(null, load);
    head.appendChild(add);
    container.appendChild(head);

    const card = ui.el('div', { class: 'card' });
    container.appendChild(card);

    async function load() {
      card.innerHTML = '';
      card.appendChild(ui.el('div', { class: 'loading' }, [ui.el('span', { class: 'spinner' }), 'Loading teams…']));
      let rows = [];
      try { rows = await OMS.api.get('/teams'); }
      catch (e) { card.innerHTML = ''; card.appendChild(ui.el('div', { class: 'alert err', text: e.message })); return; }
      card.innerHTML = '';

      if (!rows.length) {
        card.appendChild(ui.el('div', { class: 'empty' }, [
          ui.el('div', { class: 'big', text: '⛊' }),
          ui.el('h4', { text: 'No teams yet' }),
          ui.el('p', { text: 'Create teams to assign to leaders and officials.' }),
        ]));
        return;
      }

      const wrap = ui.el('div', { class: 'table-wrap' });
      const table = ui.el('table', { class: 'data' });
      table.appendChild(ui.el('thead', {}, [ui.el('tr', {}, [
        ui.el('th', { text: 'Team' }),
        ui.el('th', { text: 'Team leaders' }),
        ui.el('th', { text: 'Officials' }),
        ui.el('th', { text: 'Created' }),
        ui.el('th', { text: 'Actions' }),
      ])]));
      const tbody = ui.el('tbody');
      rows.forEach(function (t) {
        const edit = ui.el('button', { class: 'btn btn-sm btn-outline', text: 'Rename' });
        edit.onclick = () => teamModal(t, load);
        const del = ui.el('button', { class: 'btn btn-sm btn-danger', text: 'Delete' });
        del.onclick = async function () {
          const msg = 'Delete the team "' + t.name + '"? Its leaders and officials become unassigned.';
          if (!(await ui.confirm(msg, { danger: true, okText: 'Delete' }))) return;
          try { await OMS.api.del('/teams/' + t.id); ui.toast('Team deleted.', 'ok'); load(); }
          catch (e) { ui.toast(e.message, 'err'); }
        };
        tbody.appendChild(ui.el('tr', {}, [
          ui.el('td', { style: 'font-weight:600;color:var(--navy-900)', text: t.name }),
          ui.el('td', { text: String(t.leader_count) }),
          ui.el('td', { text: String(t.official_count) }),
          ui.el('td', { class: 'small muted', text: ui.fmtDate(t.created_at) }),
          ui.el('td', {}, [ui.el('div', { class: 'cell-actions' }, [edit, del])]),
        ]));
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      card.appendChild(wrap);
    }

    load();
  },
};

function teamModal(team, onDone) {
  const ui = OMS.ui;
  const isEdit = !!team;
  const name = ui.el('input', { class: 'input', value: team ? team.name : '', placeholder: 'e.g. Choir, Ushering, Media' });
  const body = ui.el('div', {}, [ui.el('div', { class: 'field' }, [ui.el('label', { text: 'Team name' }), name])]);
  const save = ui.el('button', { class: 'btn btn-gold', text: isEdit ? 'Save changes' : 'Create team' });
  const cancel = ui.el('button', { class: 'btn btn-outline', text: 'Cancel' });
  const m = ui.modal({ title: isEdit ? 'Rename team' : 'New team', body: body, footer: [cancel, save] });
  cancel.onclick = () => m.close();
  save.onclick = async function () {
    const value = name.value.trim();
    if (!value) { ui.toast('Team name is required.', 'err'); return; }
    save.disabled = true;
    try {
      if (isEdit) await OMS.api.put('/teams/' + team.id, { name: value });
      else await OMS.api.post('/teams', { name: value });
      ui.toast(isEdit ? 'Team updated.' : 'Team created.', 'ok');
      m.close(); onDone && onDone();
    } catch (e) { ui.toast(e.message, 'err'); save.disabled = false; }
  };
}
