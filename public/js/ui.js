// js/ui.js — Primitives Covenant en vanilla : Button, IconButton, Input, Select, Badge, Kbd, Modal, Toast.
// Toutes les primitives renvoient un HTMLElement.

(function () {
const { el, icon } = window.UI;

/* ------------------ Button ------------------ */
function Button(opts = {}) {
  const {
    variant = 'secondary', size = 'md',
    icon: iconName, iconRight, children, disabled, onclick, type = 'button', style, title,
  } = opts;

  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: size === 'sm' ? 28 : size === 'lg' ? 36 : 32,
    padding: size === 'sm' ? '0 10px' : size === 'lg' ? '0 14px' : '0 12px',
    borderRadius: 8, border: '1px solid transparent',
    fontFamily: 'var(--cv-font-sans)', fontSize: 13, fontWeight: 500, lineHeight: 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'background-color 120ms, border-color 120ms, transform 80ms',
    whiteSpace: 'nowrap', userSelect: 'none',
  };
  const variants = {
    primary:     { background: 'var(--cv-accent-500)', color: '#fff', borderColor: 'var(--cv-accent-500)' },
    secondary:   { background: 'var(--cv-surface)', color: 'var(--cv-fg)', borderColor: 'var(--cv-border-strong)' },
    ghost:       { background: 'transparent', color: 'var(--cv-fg)', borderColor: 'transparent' },
    destructive: { background: 'var(--cv-danger-500)', color: '#fff', borderColor: 'var(--cv-danger-500)' },
    success:     { background: 'var(--cv-success-500)', color: '#fff', borderColor: 'var(--cv-success-500)' },
  };
  const btn = el('button', {
    type, disabled, title,
    style: { ...base, ...variants[variant], ...(style || {}) },
    onclick: disabled ? null : onclick,
    onmousedown: e => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)'; },
    onmouseup:   e => { e.currentTarget.style.transform = 'none'; },
    onmouseleave: e => { e.currentTarget.style.transform = 'none'; },
  });
  if (iconName) btn.appendChild(icon(iconName, { size: 15 }));
  if (children != null) {
    const text = typeof children === 'string' ? document.createTextNode(children) : children;
    btn.appendChild(text);
  }
  if (iconRight) btn.appendChild(icon(iconRight, { size: 15 }));
  return btn;
}

/* ------------------ IconButton ------------------ */
function IconButton(opts = {}) {
  const { icon: iconName, label, onclick, variant = 'ghost', size = 'md', disabled, weight = '', title, style } = opts;
  const dim = size === 'sm' ? 26 : size === 'lg' ? 36 : 30;
  const variants = {
    ghost:     { background: 'transparent', color: 'var(--cv-fg-muted)' },
    secondary: { background: 'var(--cv-surface)', color: 'var(--cv-fg)', border: '1px solid var(--cv-border-strong)' },
    primary:   { background: 'var(--cv-accent-500)', color: '#fff' },
    danger:    { background: 'var(--cv-danger-500)', color: '#fff' },
  };
  return el('button', {
    'aria-label': label, disabled, title: title || label,
    style: {
      width: dim, height: dim, borderRadius: 8, border: 'none',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      transition: 'background-color 120ms',
      ...variants[variant],
      ...(style || {}),
    },
    onclick: disabled ? null : onclick,
    onmouseenter: e => { if (!disabled && variant === 'ghost') e.currentTarget.style.background = 'var(--cv-surface-2)'; },
    onmouseleave: e => { if (variant === 'ghost') e.currentTarget.style.background = 'transparent'; },
  }, icon(iconName, { weight, size: 16 }));
}

/* ------------------ Input (label + input) ------------------ */
function Input(opts = {}) {
  const {
    label, value, placeholder, type = 'text', error, hint, icon: iconName,
    style, autoFocus, oninput, onkeydown, onblur, name,
  } = opts;

  const input = el('input', {
    type, value: value ?? '', placeholder, name,
    autocomplete: 'off',
    oninput, onkeydown, onblur,
    style: {
      width: '100%', boxSizing: 'border-box', height: 32,
      padding: iconName ? '0 10px 0 30px' : '0 10px',
      border: `1px solid ${error ? 'var(--cv-danger-500)' : 'var(--cv-border-strong)'}`,
      borderRadius: 8, background: 'var(--cv-surface)', color: 'var(--cv-fg)',
      font: '400 13px/1 var(--cv-font-sans)', outline: 'none',
      transition: 'border-color 120ms, box-shadow 120ms',
    },
    onfocus: e => { e.target.style.borderColor = 'var(--cv-accent-500)'; e.target.style.boxShadow = 'var(--cv-shadow-focus)'; },
    onblurCapture: null,
  });
  // Restaurer la bordure au blur (focus / blur en 2 listeners)
  input.addEventListener('blur', e => { e.target.style.borderColor = 'var(--cv-border-strong)'; e.target.style.boxShadow = 'none'; });
  if (autoFocus) setTimeout(() => input.focus(), 0);

  const wrapper = el('label', {
    style: { display: 'flex', flexDirection: 'column', gap: 4, ...(style || {}) },
  },
    label ? el('span', { style: { font: '500 12px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-muted)' } }, label) : null,
    el('span', { style: { position: 'relative', display: 'flex', alignItems: 'center' } },
      iconName ? icon(iconName, { size: 14, style: { position: 'absolute', left: 10, color: 'var(--cv-fg-subtle)' } }) : null,
      input,
    ),
    error ? el('span', { style: { font: '400 12px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-danger)' } }, error) : null,
    (hint && !error) ? el('span', { style: { font: '400 12px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-subtle)' } }, hint) : null,
  );
  wrapper.input = input;
  return wrapper;
}

/* ------------------ Select ------------------ */
function Select(opts = {}) {
  const { label, value, options, onchange, style, size = 'md', name } = opts;
  const h = size === 'sm' ? 28 : 32;
  const select = el('select', {
    name,
    onchange: onchange ? e => onchange(e.target.value) : null,
    style: {
      width: '100%', height: h, padding: '0 28px 0 10px',
      border: '1px solid var(--cv-border-strong)', borderRadius: 8,
      background: 'var(--cv-surface)', color: 'var(--cv-fg)',
      font: `400 ${size === 'sm' ? 12 : 13}px/1 var(--cv-font-sans)`,
      appearance: 'none', WebkitAppearance: 'none',
      cursor: 'pointer', outline: 'none',
    },
  },
    options.map(o => el('option', { value: o.value, selected: o.value === value }, o.label))
  );

  const wrapper = el('label', { style: { display: 'flex', flexDirection: 'column', gap: 4, ...(style || {}) } },
    label ? el('span', { style: { font: '500 12px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-muted)' } }, label) : null,
    el('span', { style: { position: 'relative', display: 'flex' } },
      select,
      icon('caret-down', { size: 12, style: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--cv-fg-subtle)', pointerEvents: 'none' } }),
    ),
  );
  wrapper.input = select;
  return wrapper;
}

/* ------------------ Autocomplete (input + suggestions, free-text accepté) ------------------ */
/* Comportement : champ libre — l'utilisateur peut taper n'importe quoi. Le dropdown
   propose les valeurs déjà existantes qui matchent (contains, insensible à la casse).
   Clavier : ↑/↓ pour parcourir, Entrée pour valider, Échap pour fermer. */
function Autocomplete(opts = {}) {
  const {
    label, value = '', placeholder, options = [], hint, autoFocus,
    style, onchange, onkeydown, name,
  } = opts;

  let suggestions = [];
  let highlighted = -1;
  let isOpen = false;

  const input = el('input', {
    type: 'text', value, placeholder, name,
    autocomplete: 'off',
    style: {
      width: '100%', boxSizing: 'border-box', height: 32, padding: '0 10px',
      border: '1px solid var(--cv-border-strong)', borderRadius: 8,
      background: 'var(--cv-surface)', color: 'var(--cv-fg)',
      font: '400 13px/1 var(--cv-font-sans)', outline: 'none',
      transition: 'border-color 120ms, box-shadow 120ms',
    },
  });

  const list = el('div', {
    role: 'listbox',
    style: {
      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
      maxHeight: 220, overflowY: 'auto', zIndex: 50,
      background: 'var(--cv-surface)', border: '1px solid var(--cv-border)',
      borderRadius: 8, boxShadow: 'var(--cv-shadow-md)', padding: 4,
      display: 'none',
    },
  });

  function recomputeSuggestions() {
    const q = input.value.trim().toLowerCase();
    /* Uniques, triées : matchs en tête (préfixe d'abord, puis contains). Si q vide, tout. */
    const uniques = Array.from(new Set(options.filter(Boolean).map(s => s.trim()))).filter(Boolean);
    if (!q) {
      suggestions = uniques.sort((a, b) => a.localeCompare(b, 'fr')).slice(0, 50);
    } else {
      const prefix = uniques.filter(s => s.toLowerCase().startsWith(q));
      const others = uniques.filter(s => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q));
      /* On n'inclut pas une suggestion strictement égale à ce qui est déjà tapé. */
      suggestions = [...prefix, ...others].filter(s => s.toLowerCase() !== q).slice(0, 50);
    }
    highlighted = suggestions.length > 0 ? 0 : -1;
  }

  function renderList() {
    if (!isOpen || suggestions.length === 0) { list.style.display = 'none'; list.replaceChildren(); return; }
    list.style.display = 'block';
    list.replaceChildren(...suggestions.map((s, i) => el('div', {
      role: 'option',
      onmousedown: e => { e.preventDefault(); /* éviter blur avant click */ },
      onclick: () => { selectValue(s); },
      onmouseenter: () => { highlighted = i; paintHighlight(); },
      style: {
        padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
        font: '400 13px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg)',
        background: i === highlighted ? 'var(--cv-surface-2)' : 'transparent',
      },
    }, s)));
  }

  function paintHighlight() {
    Array.from(list.children).forEach((node, i) => {
      node.style.background = i === highlighted ? 'var(--cv-surface-2)' : 'transparent';
    });
  }

  function open() {
    isOpen = true;
    recomputeSuggestions();
    renderList();
  }
  function close() { isOpen = false; renderList(); }

  function selectValue(v) {
    input.value = v;
    if (onchange) onchange(v);
    close();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  input.addEventListener('focus', () => {
    input.style.borderColor = 'var(--cv-accent-500)';
    input.style.boxShadow = 'var(--cv-shadow-focus)';
    open();
  });
  input.addEventListener('blur', () => {
    input.style.borderColor = 'var(--cv-border-strong)';
    input.style.boxShadow = 'none';
    setTimeout(close, 100); // laisse le temps au mousedown sur la liste
  });
  input.addEventListener('input', () => {
    if (onchange) onchange(input.value);
    open();
  });
  input.addEventListener('keydown', (e) => {
    if (isOpen && suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); highlighted = (highlighted + 1) % suggestions.length; paintHighlight(); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); highlighted = (highlighted - 1 + suggestions.length) % suggestions.length; paintHighlight(); return; }
      if (e.key === 'Enter' && highlighted >= 0) {
        /* Entrée valide la suggestion surlignée ; sinon laisse passer pour valider le formulaire. */
        e.preventDefault();
        selectValue(suggestions[highlighted]);
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    }
    if (onkeydown) onkeydown(e);
  });

  if (autoFocus) setTimeout(() => input.focus(), 0);

  const wrapper = el('label', {
    style: { display: 'flex', flexDirection: 'column', gap: 4, position: 'relative', ...(style || {}) },
  },
    label ? el('span', { style: { font: '500 12px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-muted)' } }, label) : null,
    el('span', { style: { position: 'relative', display: 'flex', alignItems: 'center' } },
      input,
      list,
    ),
    hint ? el('span', { style: { font: '400 12px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-subtle)' } }, hint) : null,
  );
  wrapper.input = input;
  return wrapper;
}

/* ------------------ Badge ------------------ */
function Badge(opts = {}) {
  const { variant = 'neutral', dot, children, style } = opts;
  const variants = {
    neutral: { bg: 'var(--cv-neutral-100)', fg: 'var(--cv-neutral-700)', dot: 'var(--cv-neutral-500)' },
    success: { bg: 'var(--cv-success-100)', fg: 'var(--cv-success-700)', dot: 'var(--cv-success-500)' },
    warning: { bg: 'var(--cv-warning-100)', fg: 'var(--cv-warning-700)', dot: 'var(--cv-warning-500)' },
    danger:  { bg: 'var(--cv-danger-100)',  fg: 'var(--cv-danger-700)',  dot: 'var(--cv-danger-500)' },
    accent:  { bg: 'var(--cv-accent-100)',  fg: 'var(--cv-accent-700)',  dot: 'var(--cv-accent-500)' },
  };
  const v = variants[variant];
  return el('span', {
    style: {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '2px 8px', borderRadius: 9999,
      background: v.bg, color: v.fg,
      font: '500 11px/1.4 var(--cv-font-sans)',
      ...(style || {}),
    },
  },
    dot ? el('span', { style: { width: 6, height: 6, borderRadius: '50%', background: v.dot } }) : null,
    children,
  );
}

/* ------------------ Kbd ------------------ */
function Kbd(text) {
  return el('span', {
    style: {
      font: '500 11px/1 var(--cv-font-mono)', padding: '2px 6px',
      border: '1px solid var(--cv-border)', borderBottomWidth: 2, borderRadius: 4,
      background: 'var(--cv-surface)', color: 'var(--cv-fg-muted)',
    },
  }, text);
}

/* ------------------ Modal ------------------ */
function Modal(opts = {}) {
  const { title, body, footer, width = 460, onclose } = opts;

  const root = el('div', {
    role: 'dialog', 'aria-modal': 'true', 'aria-label': title || '',
    style: {
      position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--cv-overlay)',
      animation: 'cv-fade 180ms var(--cv-ease-standard)',
    },
    onclick: e => { if (e.target === e.currentTarget) close(); },
  },
    el('div', {
      style: {
        width, maxWidth: 'calc(100vw - 48px)',
        background: 'var(--cv-surface)', borderRadius: 12,
        boxShadow: 'var(--cv-shadow-lg)', border: '1px solid var(--cv-border)',
        display: 'flex', flexDirection: 'column',
        animation: 'cv-modal-in 180ms var(--cv-ease-standard)',
      },
    },
      title ? el('div', {
        style: { padding: '16px 20px', borderBottom: '1px solid var(--cv-border)', display: 'flex', alignItems: 'center' },
      },
        el('div', { style: { font: '600 15px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg)' } }, title),
        el('button', {
          'aria-label': 'Fermer',
          onclick: () => close(),
          style: {
            marginLeft: 'auto', background: 'none', border: 0, color: 'var(--cv-fg-muted)',
            cursor: 'pointer', padding: 4, display: 'inline-flex',
          },
        }, icon('x', { size: 16 })),
      ) : null,
      el('div', { style: { padding: '16px 20px', font: '400 13px/1.5 var(--cv-font-sans)', color: 'var(--cv-fg)' } }, body),
      footer ? el('div', {
        style: {
          padding: '12px 20px', borderTop: '1px solid var(--cv-border)',
          background: 'var(--cv-neutral-50)', display: 'flex', gap: 8,
          justifyContent: 'flex-end', borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
        },
      }, footer) : null,
    ),
  );

  function close() {
    document.removeEventListener('keydown', onKey);
    root.remove();
    if (onclose) onclose();
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);

  document.body.appendChild(root);
  return { root, close };
}

/* ------------------ Toast ------------------ */
function ToastHost() {
  const host = el('div', {
    style: {
      position: 'fixed', bottom: 20, right: 20,
      display: 'flex', flexDirection: 'column', gap: 8, zIndex: 400,
      pointerEvents: 'none',
    },
  });
  document.body.appendChild(host);

  function push({ variant = 'info', title, body }) {
    const icons = { success: 'check-circle', warning: 'warning', danger: 'x-circle', info: 'info' };
    const colors = { success: '#4ade80', warning: '#facc15', danger: '#fb7185', info: '#fdba74' };
    const node = el('div', {
      role: 'status',
      style: {
        padding: '10px 14px', background: '#09090b', color: '#fafafa',
        borderRadius: 10, font: '400 13px/1.4 var(--cv-font-sans)',
        boxShadow: 'var(--cv-shadow-xl)', display: 'flex', gap: 10, alignItems: 'flex-start',
        minWidth: 280, maxWidth: 380,
        animation: 'cv-slide-in 200ms var(--cv-ease-standard)',
        pointerEvents: 'auto',
      },
    },
      icon(icons[variant] || 'info', { size: 16, style: { color: colors[variant] || colors.info, marginTop: 1 } }),
      el('div', { style: { flex: 1 } },
        title ? el('div', { style: { fontWeight: 500 } }, title) : null,
        body  ? el('div', { style: { color: '#a1a1aa', marginTop: title ? 2 : 0 } }, body) : null,
      ),
      el('button', {
        'aria-label': 'Fermer',
        onclick: () => node.remove(),
        style: { background: 'none', border: 0, color: '#a1a1aa', cursor: 'pointer', padding: 0 },
      }, icon('x')),
    );
    host.appendChild(node);
    setTimeout(() => node.remove(), 3500);
  }

  return { push };
}

window.UI = Object.assign(window.UI, { Button, IconButton, Input, Select, Autocomplete, Badge, Kbd, Modal, ToastHost });
})();
