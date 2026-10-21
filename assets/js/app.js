/* App bootstrap: routing, shell, navigation. */
window.OMS = window.OMS || {};
OMS.pages = OMS.pages || {};
OMS.VERSION = '1.0.0';

(function () {
  const ui = OMS.ui;

  const NAV = [
    { group: 'Overview', items: [
      { label: 'Dashboard', href: '#/dashboard', icon: '◈', roles: ['super_admin', 'programs_manager', 'team_leader'] },
    ]},
    { group: 'Programs', items: [
      { label: 'Programs', href: '#/events', icon: '❖', roles: ['super_admin', 'programs_manager'] },
      { label: 'Submissions', href: '#/submissions', icon: '✎', roles: ['super_admin', 'programs_manager'] },
      { label: 'My Programs', href: '#/events', icon: '❖', roles: ['team_leader'] },
      { label: 'Accept Invite', href: '#/accept', icon: '✉', roles: ['team_leader'] },
    ]},
    { group: 'Personnel', items: [
      { label: 'My Officials', href: '#/officials', icon: '☰', roles: ['team_leader'] },
    ]},
    { group: 'Administration', items: [
      { label: 'Users & Roles', href: '#/users', icon: '⚙', roles: ['super_admin'] },
      { label: 'Teams', href: '#/teams', icon: '⛊', roles: ['super_admin'] },
      { label: 'My Profile', href: '#/profile', icon: '●', roles: ['super_admin', 'programs_manager', 'team_leader'] },
    ]},
  ];

  function currentNavHref() {
    const path = OMS.router.currentPath();
    const seg = '/' + path.split('/').filter(Boolean).slice(0, 1).join('/');
    return '#' + (seg === '/' ? '/dashboard' : seg);
  }

  function buildSidebar(user, onClose) {
    const aside = ui.el('aside', { class: 'sidebar' });
    const brand = ui.el('div', { class: 'brand' }, [
      ui.el('img', { class: 'brand-logo', src: '/assets/icons/logo.png', alt: 'OMS logo' }),
      ui.el('div', { class: 'name' }, [
        'Officials Management',
        ui.el('span', { text: 'System' }),
      ]),
    ]);
    const closeBtn = ui.el('button', { class: 'side-close', html: '&times;', 'aria-label': 'Close navigation' });
    closeBtn.onclick = function () { if (onClose) onClose(); };
    brand.appendChild(closeBtn);
    aside.appendChild(brand);

    const nav = ui.el('nav', { class: 'nav' });
    const activeHref = currentNavHref();
    NAV.forEach(function (group) {
      const items = group.items.filter((it) => it.roles.indexOf(user.role) !== -1);
      if (!items.length) return;
      nav.appendChild(ui.el('div', { class: 'group-label', text: group.group }));
      items.forEach(function (it) {
        const link = ui.el('a', {
          href: it.href,
          class: it.href.split('?')[0] === activeHref ? 'active' : '',
        }, [
          ui.el('span', { class: 'ico', text: it.icon }),
          ui.el('span', { text: it.label }),
        ]);
        link.addEventListener('click', function () { if (onClose) onClose(); });
        nav.appendChild(link);
      });
    });
    aside.appendChild(nav);
    aside.appendChild(ui.el('div', { class: 'foot' }, [
      ui.el('div', { text: '© 2026 OMS' }),
      ui.el('div', { text: 'Version ' + OMS.VERSION }),
    ]));
    return aside;
  }

  function buildTopbar(user, pageTitle, pageSub, onMenu) {
    const top = ui.el('header', { class: 'topbar' });
    const left = ui.el('div', { class: 'topbar-left' });
    const menu = ui.el('button', { class: 'menu-btn', html: '&#9776;', 'aria-label': 'Open navigation' });
    menu.onclick = function () { if (onMenu) onMenu(); };
    left.appendChild(menu);
    left.appendChild(ui.el('div', { class: 'title' }, [
      pageTitle || 'Dashboard',
      pageSub ? ui.el('small', { text: pageSub }) : null,
    ]));
    top.appendChild(left);

    const chip = ui.el('div', { class: 'user-chip' });
    const name = ((user.first_name || '') + ' ' + (user.last_name || '')).trim() || user.username;
    chip.appendChild(ui.el('div', { class: 'avatar', text: ui.initials(user.first_name, user.last_name) }));
    chip.appendChild(ui.el('div', { class: 'who' }, [
      ui.el('b', { text: name }),
      ui.el('span', { text: ui.roleLabel(user.role) }),
    ]));

    const logout = ui.el('button', { class: 'btn-ghost', text: 'Sign out' });
    logout.onclick = async function () {
      const yes = await ui.confirm('Sign out?', { okText: 'Sign out' });
      if (!yes) return;
      OMS.store.logout();
      location.hash = '#/login';
    };
    chip.appendChild(logout);
    top.appendChild(chip);
    return top;
  }

  async function renderShell(container, page, params) {
    const user = OMS.store.getUser();
    document.body.classList.remove('nav-open');

    const layout = ui.el('div', { class: 'layout' });
    const sidebar = buildSidebar(user, function () { setSidebar(false); });
    const backdrop = ui.el('div', { class: 'backdrop' });

    function setSidebar(open) {
      sidebar.classList.toggle('open', open);
      backdrop.classList.toggle('show', open);
      document.body.classList.toggle('nav-open', open);
    }
    backdrop.onclick = function () { setSidebar(false); };

    layout.appendChild(sidebar);

    const main = ui.el('main', { class: 'main' });
    main.appendChild(buildTopbar(user, page.title, page.subtitle, function () { setSidebar(true); }));
    const content = ui.el('div', { class: 'content' });
    main.appendChild(content);
    layout.appendChild(main);
    container.innerHTML = '';
    container.appendChild(layout);
    container.appendChild(backdrop);

    content.appendChild(ui.el('div', { class: 'loading' }, [
      ui.el('span', { class: 'spinner' }), ui.el('span', { text: 'Loading…' }),
    ]));

    try {
      await page.render(content, params);
    } catch (err) {
      content.innerHTML = '';
      content.appendChild(ui.el('div', { class: 'card card-pad' }, [
        ui.el('div', { class: 'alert err', text: err.message || 'Something went wrong.' }),
      ]));
    }
  }

  async function renderFullscreen(container, page, params) {
    container.innerHTML = '';
    try {
      await page.render(container, params);
    } catch (err) {
      container.appendChild(ui.el('div', { class: 'alert err', text: err.message }));
    }
  }

  async function handleRoute() {
    const path = OMS.router.currentPath();
    const match = OMS.router.resolve(path);
    const app = document.getElementById('app');

    if (!match) {
      app.innerHTML = '';
      app.appendChild(ui.el('div', { class: 'empty' }, [
        ui.el('div', { class: 'big', text: '404' }),
        ui.el('h4', { text: 'Page not found' }),
        ui.el('p', { text: 'This page does not exist.' }),
      ]));
      return;
    }

    const page = match.handler;
    const user = OMS.store.getUser();

    if (!page.public && (!OMS.store.isAuthed() || !user)) {
      location.hash = '#/login';
      return;
    }
    if (page.public && OMS.store.isAuthed() && user && page.name === 'login') {
      location.hash = '#/dashboard';
      return;
    }
    if (!page.public && user && user.must_change_password && page.name !== 'profile') {
      location.hash = '#/profile';
      return;
    }
    if (page.roles && user && page.roles.indexOf(user.role) === -1) {
      location.hash = '#/dashboard';
      return;
    }

    if (page.fullscreen) await renderFullscreen(app, page, match.params);
    else await renderShell(app, page, match.params);
    window.scrollTo(0, 0);
  }

  function registerRoutes() {
    const P = OMS.pages;
    OMS.router.on('/login', P.login);
    OMS.router.on('/dashboard', P.dashboard);
    OMS.router.on('/events', P.events);
    OMS.router.on('/events/:id', P.eventDetail);
    OMS.router.on('/join/:token', P.join);
    OMS.router.on('/accept', P.accept);
    OMS.router.on('/officials', P.officials);
    OMS.router.on('/submissions', P.submissions);
    OMS.router.on('/users', P.users);
    OMS.router.on('/teams', P.teams);
    OMS.router.on('/profile', P.profile);
  }

  async function boot() {
    registerRoutes();
    await OMS.store.loadMe();
    window.addEventListener('hashchange', handleRoute);
    window.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      const open = document.querySelector('.sidebar.open');
      if (!open) return;
      open.classList.remove('open');
      const bd = document.querySelector('.backdrop.show');
      if (bd) bd.classList.remove('show');
      document.body.classList.remove('nav-open');
    });
    if (!location.hash) location.hash = OMS.store.isAuthed() ? '#/dashboard' : '#/login';
    else handleRoute();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
