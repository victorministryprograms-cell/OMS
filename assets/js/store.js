/* Auth state store. */
window.OMS = window.OMS || {};

OMS.store = (function () {
  let user = null;

  return {
    getUser: function () { return user; },
    setUser: function (u) { user = u; },
    isAuthed: function () { return !!OMS.api.getToken(); },
    hasRole: function () {
      const roles = Array.prototype.slice.call(arguments);
      return !!user && roles.indexOf(user.role) !== -1;
    },
    isManager: function () { return this.hasRole('super_admin', 'programs_manager'); },
    isSuper: function () { return this.hasRole('super_admin'); },

    async loadMe() {
      if (!this.isAuthed()) return null;
      try {
        user = await OMS.api.get('/auth/me', { silent: true });
      } catch (e) {
        user = null;
        OMS.api.setToken('');
      }
      return user;
    },

    async login(username, password, role) {
      const res = await OMS.api.post('/auth/login', { username, password, role }, { silent: true });
      OMS.api.setToken(res.token);
      user = res.user;
      return res.user;
    },

    logout() {
      OMS.api.setToken('');
      user = null;
    },

    onUnauthorized() {
      this.logout();
      if (location.hash !== '#/login') location.hash = '#/login';
    },
  };
})();
