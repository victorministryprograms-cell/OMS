/* Programs list (manager: manage; leader: joined programs). */
OMS.pages.events = {
  name: 'events',
  title: 'Programs',
  subtitle: 'Programs and registration links',
  async render(container, params, ctx) {
    const ui = OMS.ui;
    const user = OMS.store.getUser();
    if (user.role === 'team_leader') return renderLeaderEvents(container);
    return renderManagerEvents(container);
  },
};

async function renderManagerEvents(container) {
  const ui = OMS.ui;
  container.innerHTML = '';

  const events = await OMS.api.get('/events');

  const head = ui.el('div', { class: 'between mb-2' }, [
    ui.el('div', {}, [
      ui.el('div', { class: 'section-title', text: 'All programs' }),
      ui.el('div', { class: 'section-sub', style: 'margin-bottom:0', text: events.length + ' program(s)' }),
    ]),
  ]);
  const newBtn = ui.el('button', { class: 'btn btn-gold', text: '+ Create program' });
  newBtn.onclick = () => openEventModal(null, () => renderManagerEvents(container));
  head.appendChild(newBtn);
  container.appendChild(head);

  if (!events.length) {
    container.appendChild(emptyState('❖', 'No programs yet', 'Create a program to get a registration link.'));
    return;
  }

  const card = ui.el('div', { class: 'card' });
  const wrap = ui.el('div', { class: 'table-wrap' });
  const table = ui.el('table', { class: 'data' });
  table.appendChild(ui.el('thead', {}, [ui.el('tr', {}, [
    ui.el('th', { text: 'Program' }),
    ui.el('th', { text: 'Date' }),
    ui.el('th', { text: 'Teams' }),
    ui.el('th', { text: 'Officials' }),
    ui.el('th', { text: 'Status' }),
    ui.el('th', { text: 'Actions' }),
  ])]));
  const tbody = ui.el('tbody');
  events.forEach(function (e) {
    const tr = ui.el('tr', {}, [
      ui.el('td', {}, [
        ui.el('div', { style: 'font-weight:600;color:var(--navy-900)', text: e.name }),
        ui.el('div', { class: 'small muted', text: e.venue || 'No venue set' }),
      ]),
      ui.el('td', { text: ui.fmtDate(e.event_date) + (e.start_time ? ' • ' + e.start_time : '') }),
      ui.el('td', { text: String(e.team_count || 0) }),
      ui.el('td', { text: (e.registered_count || 0) + (e.expected_count ? ' / ' + e.expected_count : '') }),
      ui.el('td', { html: '<span class="badge ' + ui.esc(e.status) + '">' + ui.esc(e.status) + '</span>' }),
      ui.el('td', {}, [ui.el('div', { class: 'cell-actions' }, [
        actionBtn('Open', () => { location.hash = '#/events/' + e.id; }),
        actionBtn('Copy link', () => copyLink(e.token)),
        actionBtn('Edit', () => openEventModal(e, () => renderManagerEvents(container))),
        actionBtn('Delete', async () => {
          if (await ui.confirm('Delete "' + e.name + '" and all its submissions?', { danger: true, okText: 'Delete' })) {
            await OMS.api.del('/events/' + e.id);
            ui.toast('Program deleted.', 'ok');
            renderManagerEvents(container);
          }
        }, 'danger'),
      ])]),
    ]);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  card.appendChild(wrap);
  container.appendChild(card);
}

async function renderLeaderEvents(container) {
  const ui = OMS.ui;
  container.innerHTML = '';
  const events = await OMS.api.get('/events');

  container.appendChild(ui.el('div', { class: 'section-title', text: 'My programs' }));
  container.appendChild(ui.el('div', { class: 'section-sub', text: 'Open a program to manage your roster.' }));

  if (!events.length) {
    container.appendChild(emptyState('❖', 'No programs joined', 'Open the link your manager shared to join a program.'));
    return;
  }

  const list = ui.el('div', { class: 'list' });
  events.forEach(function (e) {
    const row = ui.el('div', { class: 'list-item', style: 'cursor:pointer' }, [
      ui.el('div', { class: 'avatar-sm', text: '❖' }),
      ui.el('div', { class: 'meta' }, [
        ui.el('b', { text: e.name }),
        ui.el('span', { text: ui.fmtDate(e.event_date) + ' • ' + (e.my_count || 0) + ' officials selected' }),
      ]),
      ui.el('span', { html: ui.submissionBadge(e.submission_status) }),
    ]);
    row.onclick = () => { location.hash = '#/events/' + e.id; };
    list.appendChild(row);
  });
  container.appendChild(list);
}

function openEventModal(event, onDone) {
  const ui = OMS.ui;
  const isEdit = !!event;
  const f = {
    name: event ? event.name : '',
    description: event ? event.description : '',
    venue: event ? event.venue : '',
    event_date: event ? event.event_date : '',
    start_time: event ? event.start_time : '',
    end_time: event ? event.end_time : '',
    expected_count: event ? event.expected_count : 0,
    status: event ? event.status : 'open',
  };

  const name = input('text', 'Program name', f.name, 'e.g. KingsChat Officials Summit');
  const venue = input('text', 'Venue', f.venue, 'e.g. Loveworld Convocation Arena');
  const date = input('date', 'Date', f.event_date);
  const start = input('time', 'Start time', f.start_time);
  const end = input('time', 'End time', f.end_time);
  const expected = input('number', 'Expected officials per team', f.expected_count);
  const desc = ui.el('textarea', { class: 'input', placeholder: 'Optional' });
  desc.value = f.description;

  const statusSel = ui.el('select', { class: 'select' });
  ['open', 'closed'].forEach((s) => statusSel.appendChild(ui.el('option', { value: s, selected: f.status === s ? 'selected' : null, text: s === 'open' ? 'Open for registration' : 'Closed' })));

  const body = ui.el('div', {}, [
    field('Program name', name),
    field('Description', desc),
    ui.el('div', { class: 'field-row' }, [field('Venue', venue), field('Date', date)]),
    ui.el('div', { class: 'field-row-3' }, [field('Start time', start), field('End time', end), field('Expected / team', expected)]),
    field('Status', statusSel),
  ]);

  const save = ui.el('button', { class: 'btn btn-primary', text: isEdit ? 'Save changes' : 'Create program' });
  const cancel = ui.el('button', { class: 'btn btn-outline', text: 'Cancel' });

  const m = ui.modal({
    title: isEdit ? 'Edit program' : 'Create a new program',
    body: body,
    footer: [cancel, save],
  });
  cancel.onclick = () => m.close();
  save.onclick = async function () {
    const payload = {
      name: name.value.trim(), description: desc.value.trim(), venue: venue.value.trim(),
      event_date: date.value, start_time: start.value, end_time: end.value,
      expected_count: parseInt(expected.value, 10) || 0, status: statusSel.value,
    };
    if (!payload.name) { ui.toast('Program name is required.', 'err'); return; }
    save.disabled = true;
    try {
      if (isEdit) await OMS.api.put('/events/' + event.id, payload);
      else await OMS.api.post('/events', payload);
      ui.toast(isEdit ? 'Program updated.' : 'Program created.', 'ok');
      m.close();
      onDone && onDone();
    } catch (e) {
      ui.toast(e.message, 'err');
      save.disabled = false;
    }
  };
}

function copyLink(token) {
  const url = location.origin + location.pathname + '#/join/' + token;
  navigator.clipboard.writeText(url).then(
    () => OMS.ui.toast('Registration link copied.', 'ok'),
    () => OMS.ui.modal({ title: 'Registration link', body: '<p class="mono small">' + OMS.ui.esc(url) + '</p>' })
  );
}

function input(type, label, value, placeholder) {
  const ui = OMS.ui;
  const n = ui.el('input', { class: 'input', type: type, placeholder: placeholder || '' });
  if (value !== '' && value != null) n.value = value;
  return n;
}

function field(label, node) {
  return OMS.ui.el('div', { class: 'field' }, [OMS.ui.el('label', { text: label }), node]);
}

function actionBtn(text, fn, kind) {
  const ui = OMS.ui;
  const b = ui.el('button', { class: 'btn btn-sm ' + (kind === 'danger' ? 'btn-danger' : 'btn-outline'), text: text });
  b.onclick = fn;
  return b;
}

function emptyState(icon, title, text) {
  const ui = OMS.ui;
  return ui.el('div', { class: 'card' }, [ui.el('div', { class: 'empty' }, [
    ui.el('div', { class: 'big', text: icon }),
    ui.el('h4', { text: title }),
    ui.el('p', { text: text }),
  ])]);
}
