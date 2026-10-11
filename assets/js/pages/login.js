/* Login page — public. */
OMS.pages.login = {
  name: 'login',
  fullscreen: true,
  public: true,
  title: 'Sign in',
  async render(container) {
    const ui = OMS.ui;
    let role = 'programs_manager';

    const wrap = ui.el('div', { class: 'auth-wrap' });

    // Left brand panel
    const side = ui.el('div', { class: 'auth-side' }, [
      ui.el('div', {}, [
        ui.el('div', { class: 'mark-lg', text: 'OMS' }),
        ui.html`<h1>Officials Management <em>System</em></h1>`,
        ui.el('p', { text: 'A streamlined way to run programs, register your working officials, and review final rosters — from one clean console.' }),
        ui.el('ul', {}, [
          ui.el('li', {}, [ui.el('span', { class: 'tick', text: '✓' }), 'Programs managers create programs & share links']),
          ui.el('li', {}, [ui.el('span', { class: 'tick', text: '✓' }), 'Team leaders pick returning officials or add new ones']),
          ui.el('li', {}, [ui.el('span', { class: 'tick', text: '✓' }), 'Approve, request edits, and export badges to CSV']),
        ]),
      ]),
      ui.el('div', { class: 'small', style: 'color:#6c7c99', text: 'Version ' + (OMS.VERSION || '1.0.0') }),
    ]);

    // Right form
    const box = ui.el('div', { class: 'auth-box' });
    box.appendChild(ui.html`<h2>Welcome back</h2>`);
    box.appendChild(ui.el('div', { class: 'sub', text: 'Select your privilege and sign in to continue.' }));

    const roleSelect = ui.el('select', { class: 'select', autocomplete: 'off' });
    [
      { key: 'super_admin', label: '★ Super User' },
      { key: 'programs_manager', label: '❖ Programs Manager' },
      { key: 'team_leader', label: '☰ Team Leader' },
    ].forEach(function (r) {
      roleSelect.appendChild(ui.el('option', { value: r.key, text: r.label }));
    });
    roleSelect.value = role;
    roleSelect.addEventListener('change', function () { role = roleSelect.value; });
    box.appendChild(ui.el('div', { class: 'field' }, [ui.el('label', { text: 'Privilege' }), roleSelect]));

    const username = ui.el('input', { class: 'input', placeholder: 'KingsChat Username', autocomplete: 'username' });
    const password = ui.el('input', { class: 'input', type: 'password', placeholder: '••••••••', autocomplete: 'current-password' });

    box.appendChild(ui.el('div', { class: 'field' }, [ui.el('label', { text: 'KingsChat Username' }), username]));
    box.appendChild(ui.el('div', { class: 'field' }, [ui.el('label', { text: 'Password' }), password]));

    const btn = ui.el('button', { class: 'btn btn-primary btn-block', text: 'Sign in' });
    box.appendChild(btn);

    const errBox = ui.el('div', { class: 'alert err', style: 'display:none;margin-top:16px' });
    box.appendChild(errBox);

    box.appendChild(ui.el('div', { class: 'auth-note' }, [
      ui.el('b', { text: 'Forgot password?' }),
      ' Contact your Super User to have it reset. Accounts are created by your administrator.',
    ]));

    async function submit() {
      errBox.style.display = 'none';
      if (!username.value.trim() || !password.value) {
        errBox.textContent = 'Enter your username and password.';
        errBox.style.display = 'block';
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Signing in…';
      try {
        const user = await OMS.store.login(username.value.trim(), password.value, role);
        ui.toast('Welcome, ' + (user.first_name || user.username) + '!', 'ok');
        const ret = sessionStorage.getItem('oms_return');
        if (ret) {
          sessionStorage.removeItem('oms_return');
          location.hash = user.must_change_password ? '#/profile' : ret;
        } else {
          location.hash = user.must_change_password ? '#/profile' : '#/dashboard';
        }
      } catch (e) {
        errBox.textContent = e.message;
        errBox.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Sign in';
      }
    }

    btn.onclick = submit;
    [username, password].forEach((inp) => inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }));

    wrap.appendChild(side);
    wrap.appendChild(ui.el('div', { class: 'auth-main' }, [box]));
    container.appendChild(wrap);
    setTimeout(() => username.focus(), 50);
  },
};
