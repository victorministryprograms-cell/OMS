/* Profile & password management. */
OMS.pages.profile = {
  name: 'profile',
  title: 'My Profile',
  subtitle: 'Account details & security',
  async render(container) {
    const ui = OMS.ui;
    const user = OMS.store.getUser();
    container.innerHTML = '';

    const layout = ui.el('div', { class: 'grid cols-2' });

    // Details
    const details = ui.el('div', { class: 'card' });
    details.appendChild(ui.el('div', { class: 'card-head' }, [ui.el('h3', { text: 'Account details' })]));
    const dl = ui.el('div', { class: 'card-pad' });
    dl.appendChild(ui.el('div', { class: 'detail-list' }, [
      detail('Username', user.username),
      detail('Privilege', ui.roleLabel(user.role)),
      detail('First name', user.first_name || '—'),
      detail('Last name', user.last_name || '—'),
      detail('KingsChat phone', user.kingschat_phone || '—'),
      detail('Member since', ui.fmtDate(user.created_at)),
    ]));
    details.appendChild(dl);
    layout.appendChild(details);

    // Account settings (username + password)
    const pwCard = ui.el('div', { class: 'card' });
    pwCard.appendChild(ui.el('div', { class: 'card-head' }, [
      ui.el('h3', { text: 'Account settings' }),
      ui.el('p', { text: 'Update your username and password.' }),
    ]));
    const pwBody = ui.el('div', { class: 'card-pad' });

    if (user.must_change_password) {
      pwBody.appendChild(ui.el('div', { class: 'alert warn' }, [
        ui.el('b', { text: 'Action required. ' }),
        'Your account still uses the default password. Please set a new password to continue.',
      ]));
    }

    const username = ui.el('input', { class: 'input', value: user.username, autocomplete: 'username' });
    pwBody.appendChild(ui.el('div', { class: 'field' }, [ui.el('label', { text: 'Username' }), username]));

    pwBody.appendChild(ui.el('div', { class: 'divider' }));
    pwBody.appendChild(ui.el('div', { class: 'small', style: 'font-weight:600;color:var(--navy-800);margin-bottom:14px', text: 'Change password (optional)' }));

    const current = ui.el('input', { class: 'input', type: 'password', placeholder: 'Default: 1234567890', autocomplete: 'current-password' });
    const next = ui.el('input', { class: 'input', type: 'password', placeholder: 'New password', autocomplete: 'new-password' });
    const confirmPw = ui.el('input', { class: 'input', type: 'password', placeholder: 'Repeat new password', autocomplete: 'new-password' });
    pwBody.appendChild(ui.el('div', { class: 'field' }, [ui.el('label', { text: 'Current password' }), current]));
    pwBody.appendChild(ui.el('div', { class: 'field' }, [ui.el('label', { text: 'New password' }), next]));
    pwBody.appendChild(ui.el('div', { class: 'field' }, [ui.el('label', { text: 'Confirm new password' }), confirmPw]));

    const save = ui.el('button', { class: 'btn btn-gold', text: 'Save changes' });
    const msg = ui.el('div', { style: 'margin-top:14px' });
    pwBody.appendChild(save);
    pwBody.appendChild(msg);

    save.onclick = async function () {
      msg.innerHTML = '';
      const uname = username.value.trim();
      const usernameChanged = uname !== user.username;
      const wantsPassword = !!(next.value || confirmPw.value);

      if (!usernameChanged && !wantsPassword) {
        msg.appendChild(ui.el('div', { class: 'alert err', text: 'Nothing to update.' }));
        return;
      }
      if (usernameChanged && !uname) {
        msg.appendChild(ui.el('div', { class: 'alert err', text: 'Username cannot be empty.' }));
        return;
      }
      if (wantsPassword) {
        if (!current.value) { msg.appendChild(ui.el('div', { class: 'alert err', text: 'Enter your current password to change it.' })); return; }
        if (!next.value) { msg.appendChild(ui.el('div', { class: 'alert err', text: 'Enter a new password.' })); return; }
        if (next.value !== confirmPw.value) { msg.appendChild(ui.el('div', { class: 'alert err', text: 'New passwords do not match.' })); return; }
      }

      save.disabled = true;
      save.textContent = 'Saving…';
      try {
        if (usernameChanged) await OMS.api.post('/auth/update-profile', { username: uname });
        if (wantsPassword) await OMS.api.post('/auth/change-password', { current_password: current.value, new_password: next.value });
        const fresh = await OMS.api.get('/auth/me');
        OMS.store.setUser(fresh);
        ui.toast('Profile updated successfully.', 'ok');
        if (wantsPassword) location.hash = '#/dashboard';
        else OMS.pages.profile.render(container);
      } catch (e) {
        msg.appendChild(ui.el('div', { class: 'alert err', text: e.message }));
        save.disabled = false;
        save.textContent = 'Save changes';
      }
    };

    pwCard.appendChild(pwBody);
    layout.appendChild(pwCard);

    container.appendChild(layout);

    function detail(k, v) {
      return ui.el('div', {}, [ui.el('div', { class: 'k', text: k }), ui.el('div', { class: 'v', text: v })]);
    }
  },
};
