/* Manager-wide submissions review board. */
OMS.pages.submissions = {
  name: 'submissions',
  title: 'Submissions',
  subtitle: 'Review & approve rosters',
  roles: ['super_admin', 'programs_manager'],
  async render(container) {
    const ui = OMS.ui;
    container.innerHTML = '';

    let filter = 'all';
    const head = ui.el('div', { class: 'between mb-2' }, [
      ui.el('div', {}, [
        ui.el('div', { class: 'section-title', text: 'All submissions' }),
        ui.el('div', { class: 'section-sub', style: 'margin-bottom:0', text: 'Approve rosters or request edits from team leaders.' }),
      ]),
    ]);
    const tabs = ui.el('div', { class: 'role-picker', style: 'max-width:640px;grid-template-columns:repeat(5,1fr)' });
    const filters = [
      ['all', 'All'], ['submitted', 'Submitted'], ['approved', 'Approved'],
      ['revision', 'Edits'], ['draft', 'Draft'],
    ];
    const tabEls = {};
    filters.forEach(function (fOpt) {
      const t = ui.el('div', { class: 'role-opt' + (fOpt[0] === filter ? ' sel' : '') }, [ui.el('span', { class: 'ico', text: '●' }), fOpt[1]]);
      t.onclick = function () {
        filter = fOpt[0];
        Object.keys(tabEls).forEach((k) => tabEls[k].classList.toggle('sel', k === filter));
        load();
      };
      tabEls[fOpt[0]] = t;
      tabs.appendChild(t);
    });
    head.appendChild(tabs);
    container.appendChild(head);

    const card = ui.el('div', { class: 'card' });
    container.appendChild(card);

    async function load() {
      card.innerHTML = '';
      card.appendChild(ui.el('div', { class: 'loading' }, [ui.el('span', { class: 'spinner' }), 'Loading submissions…']));
      let rows = [];
      try { rows = await OMS.api.get('/submissions'); }
      catch (e) { card.innerHTML = ''; card.appendChild(ui.el('div', { class: 'alert err', text: e.message })); return; }
      if (filter !== 'all') rows = rows.filter((r) => r.status === filter);
      card.innerHTML = '';

      if (!rows.length) {
        card.appendChild(ui.el('div', { class: 'empty' }, [
          ui.el('div', { class: 'big', text: '✎' }),
          ui.el('h4', { text: 'Nothing here' }),
          ui.el('p', { text: 'No submissions match this filter yet.' }),
        ]));
        return;
      }

      const wrap = ui.el('div', { class: 'table-wrap' });
      const table = ui.el('table', { class: 'data' });
      table.appendChild(ui.el('thead', {}, [ui.el('tr', {}, [
        ui.el('th', { text: 'Team leader' }),
        ui.el('th', { text: 'Program' }),
        ui.el('th', { text: 'Officials' }),
        ui.el('th', { text: 'Status' }),
        ui.el('th', { text: 'Submitted' }),
        ui.el('th', { text: '' }),
      ])]));
      const tbody = ui.el('tbody');
      rows.forEach(function (s) {
        const review = ui.el('button', { class: 'btn btn-sm btn-outline', text: 'Review' });
        review.onclick = () => openReviewModal(s, load);
        tbody.appendChild(ui.el('tr', {}, [
          ui.el('td', {}, [
            ui.el('div', { style: 'font-weight:600;color:var(--navy-900)', text: (s.first_name + ' ' + s.last_name).trim() || s.username }),
            ui.el('div', { class: 'small muted', text: s.username }),
          ]),
          ui.el('td', { text: s.event_name }),
          ui.el('td', {}, [
            ui.el('div', { text: String(s.official_count) }),
            Number(s.approved_count) > 0 ? ui.el('div', { class: 'small muted', text: s.approved_count + ' approved' }) : null,
          ]),
          ui.el('td', { html: ui.submissionBadge(s.status) }),
          ui.el('td', { class: 'small muted', text: s.submitted_at ? ui.fmtDateTime(s.submitted_at) : '—' }),
          ui.el('td', {}, [review]),
        ]));
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      card.appendChild(wrap);
    }

    load();
  },
};
