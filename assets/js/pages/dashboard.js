/* Role-aware dashboard. */
OMS.pages.dashboard = {
  name: 'dashboard',
  title: 'Dashboard',
  subtitle: 'Your program overview',
  async render(container) {
    const ui = OMS.ui;
    const user = OMS.store.getUser();
    container.innerHTML = '';

    const greet = ui.el('div', { class: 'between mb-2' }, [
      ui.el('div', {}, [
        ui.el('div', { class: 'section-title', text: 'Welcome back, ' + (user.first_name || user.username) + ' 👋' }),
        ui.el('div', { class: 'section-sub', style: 'margin-bottom:0', text: greeting() }),
      ]),
    ]);
    container.appendChild(greet);

    if (user.role === 'team_leader') return renderLeader(container);
    return renderManager(container, user.role === 'super_admin');
  },
};

function greeting() {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return part + ' — here is what is happening today.';
}

async function renderManager(container, isSuper) {
  const ui = OMS.ui;
  const [events, submissions] = await Promise.all([
    OMS.api.get('/events'),
    OMS.api.get('/submissions'),
  ]);

  const stats = ui.el('div', { class: 'grid cols-4 mb-2' });
  const pending = submissions.filter((s) => s.status === 'submitted').length;
  const approved = submissions.filter((s) => s.status === 'approved').length;
  const officials = submissions.reduce((sum, s) => sum + (s.official_count || 0), 0);
  [
    ['Total programs', events.length, 'Across the program'],
    ['Awaiting review', pending, 'Submitted rosters'],
    ['Approved rosters', approved, 'Ready for export'],
    ['Registered officials', officials, 'All teams combined'],
  ].forEach((s) => stats.appendChild(dashStat(s[0], s[1], s[2])));
  container.appendChild(stats);

  const cols = ui.el('div', { class: 'grid cols-2' });

  // Recent programs
  const evCard = ui.el('div', { class: 'card' });
  evCard.appendChild(ui.el('div', { class: 'card-head' }, [
    ui.el('h3', { text: 'Recent programs' }),
    dashLink('View all', '#/events'),
  ]));
  if (!events.length) {
    evCard.appendChild(dashEmpty('❖', 'No programs yet', 'Create your first program to generate a link for team leaders.'));
  } else {
    const list = ui.el('div', { class: 'card-pad list' });
    events.slice(0, 5).forEach(function (e) {
      const row = ui.el('div', { class: 'list-item', style: 'cursor:pointer' }, [
        ui.el('div', { class: 'avatar-sm', text: '❖' }),
        ui.el('div', { class: 'meta' }, [
          ui.el('b', { text: e.name }),
          ui.el('span', { text: ui.fmtDate(e.event_date) + (e.venue ? ' • ' + e.venue : '') }),
        ]),
        ui.el('span', { class: 'badge navy', text: (e.registered_count || 0) + ' officials' }),
      ]);
      row.onclick = () => { location.hash = '#/events/' + e.id; };
      list.appendChild(row);
    });
    evCard.appendChild(list);
  }
  cols.appendChild(evCard);

  // Pending reviews
  const subCard = ui.el('div', { class: 'card' });
  subCard.appendChild(ui.el('div', { class: 'card-head' }, [
    ui.el('h3', { text: 'Needs your review' }),
    dashLink('All submissions', '#/submissions'),
  ]));
  const pendingList = submissions.filter((s) => s.status === 'submitted');
  if (!pendingList.length) {
    subCard.appendChild(dashEmpty('✓', 'Nothing pending', 'All submitted rosters have been reviewed.'));
  } else {
    const list = ui.el('div', { class: 'card-pad list' });
    pendingList.slice(0, 5).forEach(function (s) {
      const row = ui.el('div', { class: 'list-item' }, [
        ui.el('div', { class: 'avatar-sm', text: ui.initials(s.first_name, s.last_name) }),
        ui.el('div', { class: 'meta' }, [
          ui.el('b', { text: (s.first_name + ' ' + s.last_name).trim() || s.username }),
          ui.el('span', { text: s.event_name }),
        ]),
        ui.el('span', { class: 'badge submitted', text: s.official_count + ' officials' }),
      ]);
      row.onclick = () => { location.hash = '#/submissions'; };
      list.appendChild(row);
    });
    subCard.appendChild(list);
  }
  cols.appendChild(subCard);

  container.appendChild(cols);

  if (isSuper) {
    const note = ui.el('div', { class: 'alert info mt-2' }, [
      ui.el('b', { text: 'Super User access: ' }),
      'You can manage all accounts, roles and privileges from ',
      dashLink('Users & Roles', '#/users'),
      '.',
    ]);
    container.appendChild(note);
  }
}

async function renderLeader(container) {
  const ui = OMS.ui;
  const [events, officials] = await Promise.all([
    OMS.api.get('/events'),
    OMS.api.get('/officials'),
  ]);

  const submitted = events.filter((e) => e.submission_status === 'submitted').length;
  const approved = events.filter((e) => e.submission_status === 'approved').length;
  const rosterTotal = events.reduce((sum, e) => sum + (e.my_count || 0), 0);

  const stats = ui.el('div', { class: 'grid cols-4 mb-2' });
  [
    ['My programs', events.length, 'Programs you joined'],
    ['Officials on file', officials.length, 'Reusable records'],
    ['Submitted', submitted, 'Awaiting approval'],
    ['Approved', approved, 'Confirmed rosters'],
  ].forEach((s) => stats.appendChild(dashStat(s[0], s[1], s[2])));
  container.appendChild(stats);

  const card = ui.el('div', { class: 'card' });
  card.appendChild(ui.el('div', { class: 'card-head' }, [
    ui.el('h3', { text: 'My programs' }),
    dashLink('Manage officials', '#/officials'),
  ]));
  if (!events.length) {
    card.appendChild(dashEmpty('❖', 'No programs yet', 'Open the unique link a Programs Manager shared with you to register your officials.'));
  } else {
    const list = ui.el('div', { class: 'card-pad list' });
    events.forEach(function (e) {
      const row = ui.el('div', { class: 'list-item', style: 'cursor:pointer' }, [
        ui.el('div', { class: 'avatar-sm', text: '❖' }),
        ui.el('div', { class: 'meta' }, [
          ui.el('b', { text: e.name }),
          ui.el('span', { text: ui.fmtDate(e.event_date) + ' • ' + (e.my_count || 0) + ' of ' + (e.expected_count || 0) + ' officials' }),
        ]),
        ui.el('span', { html: ui.submissionBadge(e.submission_status) }),
      ]);
      row.onclick = () => { location.hash = '#/events/' + e.id; };
      list.appendChild(row);
    });
    card.appendChild(list);
  }
  container.appendChild(card);
  container.appendChild(ui.el('div', { class: 'alert info mt-2' }, [
    ui.el('b', { text: 'Tip: ' }),
    'You can build your roster from officials you have used before, or add brand-new officials with their KingsChat phone number.',
  ]));
}

function dashStat(label, value, hint) {
  const ui = OMS.ui;
  return ui.el('div', { class: 'stat' }, [
    ui.el('div', { class: 'label', text: label }),
    ui.el('div', { class: 'value', text: String(value) }),
    ui.el('div', { class: 'hint', text: hint }),
  ]);
}

function dashEmpty(icon, title, text) {
  const ui = OMS.ui;
  return ui.el('div', { class: 'empty' }, [
    ui.el('div', { class: 'big', text: icon }),
    ui.el('h4', { text: title }),
    ui.el('p', { text: text }),
  ]);
}

function dashLink(text, href) {
  const ui = OMS.ui;
  return ui.el('a', { href: href, class: 'small', style: 'font-weight:600', text: text });
}
