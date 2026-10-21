/* Event landing page reached via the unique team-leader link. */
OMS.pages.join = {
  name: 'join',
  fullscreen: true,
  public: true,
  title: 'Program invitation',
  async render(container, params) {
    const ui = OMS.ui;
    container.innerHTML = '';

    let event = null;
    let error = null;
    try { event = await OMS.api.get('/public/event/' + params.token); }
    catch (e) { error = e.message; }

    const wrap = ui.el('div', { class: 'auth-wrap' });
    const side = ui.el('div', { class: 'auth-side' }, [
      ui.el('div', {}, [
        ui.el('img', { class: 'auth-logo', src: '/assets/icons/logo.png', alt: 'OMS logo' }),
        ui.html`<h1>You are invited to <em>serve</em></h1>`,
        ui.el('p', { text: 'Your manager shared this program with you. Register your officials to confirm your roster.' }),
      ]),
      ui.el('div', { class: 'small', style: 'color:#6c7c99', text: 'Officials Management System' }),
    ]);

    const box = ui.el('div', { class: 'auth-box' });
    if (error) {
      box.appendChild(ui.el('div', { class: 'alert err', text: error }));
      box.appendChild(homeBtn());
    } else {
      box.appendChild(ui.el('div', { class: 'sub', text: 'Program details' }));
      box.appendChild(ui.el('h2', { style: 'font-size:22px', text: event.name }));
      const info = ui.el('div', { class: 'card card-pad mt-2' });
      info.appendChild(ui.el('div', { class: 'detail-list' }, [
        d('Venue', event.venue || '—'),
        d('Date', ui.fmtDate(event.event_date)),
        d('Time', (event.start_time || '—') + (event.end_time ? ' – ' + event.end_time : '')),
        d('Expected / team', event.expected_count || '—'),
      ]));
      box.appendChild(info);

      const user = OMS.store.getUser();
      const action = ui.el('div', { class: 'mt-3' });
      if (!OMS.store.isAuthed() || !user) {
        action.appendChild(ui.el('div', { class: 'alert info', text: 'Sign in as a Team Leader to register officials.' }));
        const signin = ui.el('button', { class: 'btn btn-gold btn-block', text: 'Sign in to register' });
        signin.onclick = function () {
          sessionStorage.setItem('oms_return', '#/join/' + params.token);
          location.hash = '#/login';
        };
        action.appendChild(signin);
      } else if (user.role === 'team_leader') {
        if (event.status !== 'open') {
          action.appendChild(ui.el('div', { class: 'alert warn', text: 'Registration is closed.' }));
        }
        const join = ui.el('button', { class: 'btn btn-gold btn-block', text: 'Open my roster for this program' });
        join.onclick = async function () {
          join.disabled = true; join.textContent = 'Opening…';
          try {
            const res = await OMS.api.post('/events/join/' + params.token, {});
            ui.toast('You have joined ' + event.name + '.', 'ok');
            location.hash = '#/events/' + res.event.id;
          } catch (e) { ui.toast(e.message, 'err'); join.disabled = false; join.textContent = 'Open my roster for this program'; }
        };
        action.appendChild(join);
      } else {
        action.appendChild(ui.el('div', { class: 'alert info', text: 'Signed in as a Programs Manager. Team leaders use this link to register.' }));
        action.appendChild(homeBtn());
      }
      box.appendChild(action);
    }

    wrap.appendChild(side);
    wrap.appendChild(ui.el('div', { class: 'auth-main' }, [box]));
    container.appendChild(wrap);

    function d(k, v) { return ui.el('div', {}, [ui.el('div', { class: 'k', text: k }), ui.el('div', { class: 'v', text: v })]); }
    function homeBtn() {
      const b = ui.el('button', { class: 'btn btn-outline btn-block', text: 'Go to dashboard' });
      b.onclick = () => { location.hash = OMS.store.isAuthed() ? '#/dashboard' : '#/login'; };
      return b;
    }
  },
};
