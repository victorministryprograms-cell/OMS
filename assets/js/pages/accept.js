/* Accept Invite — team leader pastes a program link shared by a manager. */
OMS.pages.accept = {
  name: 'accept',
  title: 'Accept Invite',
  subtitle: 'Enter a program link',
  roles: ['team_leader'],
  async render(container) {
    const ui = OMS.ui;
    container.innerHTML = '';

    const card = ui.el('div', { class: 'card card-pad', style: 'max-width:640px' });
    card.appendChild(ui.el('h3', { text: 'Accept a program invite' }));
    card.appendChild(ui.el('p', {
      class: 'small muted',
      style: 'margin:6px 0 16px;line-height:1.6',
      text: 'Paste the link your manager sent you, e.g. ' +
        location.origin + location.pathname + '#/join/xxxxxxxx.',
    }));

    const input = ui.el('input', { class: 'input', placeholder: 'Paste program link here', autocomplete: 'off' });
    card.appendChild(ui.el('div', { class: 'field' }, [ui.el('label', { text: 'Program link' }), input]));

    const errBox = ui.el('div', { class: 'alert err', style: 'display:none;margin-top:12px' });
    card.appendChild(errBox);

    const btn = ui.el('button', { class: 'btn btn-gold', text: 'Continue' });
    card.appendChild(ui.el('div', { class: 'row mt-2' }, [btn]));
    container.appendChild(card);

    function extractToken(text) {
      text = (text || '').trim();
      if (!text) return '';
      const m = text.match(/join\/([A-Za-z0-9._-]+)/i);
      if (m) return m[1];
      if (/^[A-Za-z0-9._-]+$/.test(text)) return text;
      return '';
    }

    function submit() {
      errBox.style.display = 'none';
      const token = extractToken(input.value);
      if (!token) {
        errBox.textContent = 'That is not a valid link. Paste the full link your manager sent.';
        errBox.style.display = 'block';
        input.focus();
        return;
      }
      location.hash = '#/join/' + token;
    }

    btn.onclick = submit;
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    setTimeout(() => input.focus(), 50);
  },
};
