/* Super Admin — user & role management. */
OMS.pages.users = {
  name: 'users',
  title: 'Users & Roles',
  subtitle: 'Accounts and roles',
  roles: ['super_admin'],
  async render(container) {
    const ui = OMS.ui;
    container.innerHTML = '';

    const head = ui.el('div', { class: 'between mb-2' }, [
      ui.el('div', {}, [
        ui.el('div', { class: 'section-title', text: 'All accounts' }),
        ui.el('div', { class: 'section-sub', style: 'margin-bottom:0', text: 'Create users, assign roles and reset passwords.' }),
      ]),
    ]);
    const add = ui.el('button', { class: 'btn btn-gold', text: '+ New user' });
    add.onclick = async () => userModal(null, load, await ui.fetchTeams());
    head.appendChild(add);
    container.appendChild(head);

    const card = ui.el('div', { class: 'card' });
    container.appendChild(card);

    async function load() {
      card.innerHTML = '';
      card.appendChild(ui.el('div', { class: 'loading' }, [ui.el('span', { class: 'spinner' }), 'Loading users…']));
      let rows = [];
      try { rows = await OMS.api.get('/users'); }
      catch (e) { card.innerHTML = ''; card.appendChild(ui.el('div', { class: 'alert err', text: e.message })); return; }
      card.innerHTML = '';
      const me = OMS.store.getUser();

      const wrap = ui.el('div', { class: 'table-wrap' });
      const table = ui.el('table', { class: 'data' });
      table.appendChild(ui.el('thead', {}, [ui.el('tr', {}, [
        ui.el('th', { text: 'Name' }),
        ui.el('th', { text: 'Username' }),
        ui.el('th', { text: 'Privilege' }),
        ui.el('th', { text: 'Team' }),
        ui.el('th', { text: 'KingsChat' }),
        ui.el('th', { text: 'Status' }),
        ui.el('th', { text: 'Actions' }),
      ])]));
      const tbody = ui.el('tbody');
      rows.forEach(function (u) {
        const edit = ui.el('button', { class: 'btn btn-sm btn-outline', text: 'Edit' });
        edit.onclick = async () => userModal(u, load, await ui.fetchTeams());

        const reset = ui.el('button', { class: 'btn btn-sm btn-outline', text: 'Reset password' });
        reset.onclick = async function () {
          if (!(await ui.confirm('Reset ' + u.username + '\u2019s password to the default (1234567890)?', { okText: 'Reset' }))) return;
          try { await OMS.api.post('/users/' + u.id + '/reset-password', {}); ui.toast('Password reset to default.', 'ok'); }
          catch (e) { ui.toast(e.message, 'err'); }
        };

        const toggle = ui.el('button', { class: 'btn btn-sm ' + (u.active ? 'btn-danger' : 'btn-outline'), text: u.active ? 'Disable' : 'Enable' });
        toggle.onclick = async function () {
          try { await OMS.api.put('/users/' + u.id, { active: !u.active }); ui.toast('User updated.', 'ok'); load(); }
          catch (e) { ui.toast(e.message, 'err'); }
        };

        const actions = [edit, reset, toggle];
        if (u.id !== me.id) {
          const del = ui.el('button', { class: 'btn btn-sm btn-danger', text: 'Delete' });
          del.onclick = async function () {
            if (!(await ui.confirm('Delete the account "' + u.username + '"? This cannot be undone.', { danger: true, okText: 'Delete' }))) return;
            try { await OMS.api.del('/users/' + u.id); ui.toast('User deleted.', 'ok'); load(); }
            catch (e) { ui.toast(e.message, 'err'); }
          };
          actions.push(del);
        }

        tbody.appendChild(ui.el('tr', {}, [
          ui.el('td', { style: 'font-weight:600;color:var(--navy-900)', text: ((u.first_name + ' ' + u.last_name).trim()) || '—' }),
          ui.el('td', { class: 'mono small', text: u.username }),
          ui.el('td', { html: '<span class="badge navy">' + ui.esc(ui.roleLabel(u.role)) + '</span>' }),
          ui.el('td', { text: u.role === 'team_leader' ? (u.team_name || '—') : '—' }),
          ui.el('td', { class: 'mono small', text: u.kingschat_phone || '—' }),
          ui.el('td', { html: '<span class="badge ' + (u.active ? 'approved' : 'draft') + '">' + (u.active ? 'Active' : 'Disabled') + '</span>' }),
          ui.el('td', {}, [ui.el('div', { class: 'cell-actions' }, actions)]),
        ]));
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      card.appendChild(wrap);
    }

    load();
  },
};

function userModal(user, onDone, teams) {
  const ui = OMS.ui;
  const isEdit = !!user;
  function f(label, node) { return ui.el('div', { class: 'field' }, [ui.el('label', { text: label }), node]); }

  const username = ui.el('input', { class: 'input', value: user ? user.username : '', placeholder: 'kingschat username', disabled: isEdit ? 'disabled' : null });
  const first = ui.el('input', { class: 'input', value: user ? user.first_name : '', placeholder: 'First name' });
  const last = ui.el('input', { class: 'input', value: user ? user.last_name : '', placeholder: 'Last name' });
  const phone = ui.el('input', { class: 'input', value: user ? user.kingschat_phone : '', placeholder: '2348012345678' });

  const roleSel = ui.el('select', { class: 'select' });
  [
    ['super_admin', 'Super User'],
    ['programs_manager', 'Programs Manager'],
    ['team_leader', 'Team Leader'],
  ].forEach((r) => roleSel.appendChild(ui.el('option', { value: r[0], selected: user && user.role === r[0] ? 'selected' : null, text: r[1] })));

  const team = ui.teamSelect(teams, user ? user.team_id : null);
  const teamField = f('Team', team);
  function syncTeam() { teamField.style.display = roleSel.value === 'team_leader' ? '' : 'none'; }
  roleSel.onchange = syncTeam;

  // A brand new account's password must never be filled in by the browser
  // or a password manager: "new-password" tells the browser this is not an
  // existing credential, and the data-* attributes skip password managers.
  const password = ui.passwordInput({
    placeholder: 'Defaults to 1234567890',
    autocomplete: 'new-password',
    name: 'new_account_password',
    'data-lpignore': 'true',
    'data-1p-ignore': 'true',
    autocorrect: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
  });

  const body = ui.el('div', {}, [
    ui.el('div', { class: 'field-row' }, [f('KingsChat Username', username), f('Privilege', roleSel)]),
    ui.el('div', { class: 'field-row' }, [f('First name', first), f('Last name', last)]),
    f('KingsChat phone', phone),
    teamField,
    isEdit ? null : f('Initial password (optional)', password.wrap),
    isEdit ? null : ui.el('div', { class: 'hint', text: 'Defaults to 1234567890.' }),
  ]);
  syncTeam();

  const save = ui.el('button', { class: 'btn btn-gold', text: isEdit ? 'Save changes' : 'Create user' });
  const cancel = ui.el('button', { class: 'btn btn-outline', text: 'Cancel' });
  const m = ui.modal({ title: isEdit ? 'Edit user' : 'Create user', body: body, footer: [cancel, save] });
  cancel.onclick = () => m.close();

  save.onclick = async function () {
    const payload = {
      first_name: first.value.trim(), last_name: last.value.trim(),
      kingschat_phone: phone.value.trim(), role: roleSel.value,
      team_id: roleSel.value === 'team_leader' && team.value ? parseInt(team.value, 10) : null,
    };
    if (!isEdit) {
      payload.username = username.value.trim();
      if (password.input.value) payload.password = password.input.value;
      if (!payload.username) { ui.toast('Username is required.', 'err'); return; }
    }
    save.disabled = true;
    try {
      if (isEdit) await OMS.api.put('/users/' + user.id, payload);
      else await OMS.api.post('/users', payload);
      ui.toast(isEdit ? 'User updated.' : 'User created.', 'ok');
      m.close(); onDone && onDone();
    } catch (e) { ui.toast(e.message, 'err'); save.disabled = false; }
  };
}
