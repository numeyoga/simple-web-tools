/* @ds-bundle: {"format":4,"namespace":"Covenant","components":[]} */
/* Covenant Design System — behaviours (Vanilla Web, no dependency).
   Native HTML first: <dialog> for modals, drawers and the command menu, the
   popover attribute for menus, native inputs for dates. This script only adds
   what the platform does not provide. Load once; it initialises itself and
   exposes window.Covenant = { init, toast, setTextSize, getTextSize, openDialog, closeDialog,
   categoryColors, setCategory }. */
(function () {
  'use strict';
  if (window.Covenant && window.Covenant.__loaded) return;

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  var uid = 0;
  function nextId(prefix) { uid += 1; return prefix + '-' + uid; }
  function each(root, sel, fn) { Array.prototype.forEach.call(root.querySelectorAll(sel), fn); }
  function once(el, key) { if (el.dataset[key]) return false; el.dataset[key] = '1'; return true; }

  /* ---------- Dialogs: modal, drawer, command menu ---------- */
  var openers = new WeakMap();
  function openDialog(dialog, opener) {
    if (!dialog || dialog.open) return;
    openers.set(dialog, opener || document.activeElement);
    dialog.showModal();
    var auto = dialog.querySelector('[autofocus]') || dialog.querySelector(FOCUSABLE);
    if (auto) auto.focus();
  }
  function closeDialog(dialog, value) { if (dialog && dialog.open) dialog.close(value); }
  function initDialog(dialog) {
    if (!once(dialog, 'cvDialog')) return;
    dialog.addEventListener('close', function () {
      var opener = openers.get(dialog);
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
    });
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) closeDialog(dialog); /* backdrop click */
    });
  }

  /* ---------- Menus (popover API) ---------- */
  function menuItems(menu) { return Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')); }
  function positionPopover(pop, invoker) {
    var r = invoker.getBoundingClientRect();
    var w = pop.offsetWidth, h = pop.offsetHeight, gap = 4;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    var top = r.bottom + gap;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - gap);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }
  function initMenu(menu) {
    if (!once(menu, 'cvMenu')) return;
    var invoker = document.querySelector('[popovertarget="' + menu.id + '"]');
    menu.addEventListener('toggle', function (e) {
      var open = e.newState === 'open';
      if (invoker) invoker.setAttribute('aria-expanded', String(open));
      if (open) {
        if (invoker) positionPopover(menu, invoker);
        var items = menuItems(menu);
        if (items[0]) items[0].focus();
      } else if (invoker && (menu.contains(document.activeElement) || document.activeElement === document.body)) {
        invoker.focus();
      }
    });
    menu.addEventListener('keydown', function (e) {
      var items = menuItems(menu), i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
      else if (e.key === 'Tab') { menu.hidePopover(); }
    });
    menu.addEventListener('click', function (e) {
      var item = e.target.closest('[role="menuitem"]');
      if (item && item.getAttribute('aria-disabled') !== 'true') menu.hidePopover();
    });
  }

  /* ---------- Tooltip (WCAG 1.4.13: dismissable, hoverable, persistent) ---------- */
  var shownTips = [];
  function initTooltip(wrap) {
    if (!once(wrap, 'cvTooltip')) return;
    var tip = wrap.querySelector('[role="tooltip"]');
    var trigger = wrap.querySelector(FOCUSABLE);
    if (!tip || !trigger) return;
    if (!tip.id) tip.id = nextId('cv-tip');
    var described = (trigger.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
    if (described.indexOf(tip.id) < 0) { described.push(tip.id); trigger.setAttribute('aria-describedby', described.join(' ')); }
    tip.hidden = true;
    var hideTimer = null;
    function show() { clearTimeout(hideTimer); tip.hidden = false; if (shownTips.indexOf(tip) < 0) shownTips.push(tip); }
    function hide() { tip.hidden = true; shownTips = shownTips.filter(function (t) { return t !== tip; }); }
    function hideSoon() { clearTimeout(hideTimer); hideTimer = setTimeout(function () { if (!wrap.contains(document.activeElement) && !wrap.matches(':hover')) hide(); }, 120); }
    wrap.addEventListener('mouseenter', show);
    wrap.addEventListener('mouseleave', hideSoon);
    trigger.addEventListener('focus', show);
    trigger.addEventListener('blur', hideSoon);
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && shownTips.length) { shownTips.slice().forEach(function (t) { t.hidden = true; }); shownTips = []; }
  });

  /* ---------- Tabs (automatic activation, roving tabindex) ---------- */
  function initTabs(root) {
    if (!once(root, 'cvTabs')) return;
    var list = root.querySelector('[role="tablist"]');
    if (!list) return;
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    }
    var current = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0];
    if (current) select(current, false);
    list.addEventListener('click', function (e) { var t = e.target.closest('[role="tab"]'); if (t) select(t, true); });
    list.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var n = null;
      if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') n = tabs[0];
      else if (e.key === 'End') n = tabs[tabs.length - 1];
      if (n) { e.preventDefault(); select(n, true); }
    });
  }

  /* ---------- Combobox (list autocomplete) and command menu ---------- */
  function initCombobox(root) {
    if (!once(root, 'cvCombobox')) return;
    var input = root.querySelector('[role="combobox"]');
    var list = root.querySelector('[role="listbox"]');
    if (!input || !list) return;
    var inline = root.hasAttribute('data-cv-inline'); /* list always visible (command menu) */
    var empty = list.querySelector('.cv-listbox__empty');
    var options = Array.prototype.slice.call(list.querySelectorAll('[role="option"]'));
    options.forEach(function (o) { if (!o.id) o.id = nextId('cv-opt'); });
    input.setAttribute('aria-autocomplete', 'list');
    var active = -1;
    function visible() { return options.filter(function (o) { return !o.hidden; }); }
    function setActive(idx) {
      var v = visible();
      options.forEach(function (o) { o.removeAttribute('data-active'); });
      active = v.length ? (idx + v.length) % v.length : -1;
      if (active >= 0) {
        v[active].setAttribute('data-active', '');
        input.setAttribute('aria-activedescendant', v[active].id);
        v[active].scrollIntoView({ block: 'nearest' });
      } else input.removeAttribute('aria-activedescendant');
    }
    function open() { if (inline) return; list.hidden = false; input.setAttribute('aria-expanded', 'true'); }
    function close() {
      if (inline) return;
      list.hidden = true; input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant'); active = -1;
    }
    function filter() {
      var q = input.value.trim().toLowerCase();
      options.forEach(function (o) { o.hidden = q !== '' && o.textContent.toLowerCase().indexOf(q) < 0; });
      if (empty) empty.hidden = visible().length > 0;
      setActive(inline ? 0 : -1);
    }
    function choose(o) {
      if (inline) {
        root.dispatchEvent(new CustomEvent('cv:command', { bubbles: true, detail: { value: o.dataset.value || o.textContent.trim() } }));
        var dlg = root.closest('dialog');
        if (dlg) closeDialog(dlg, o.dataset.value || '');
        return;
      }
      options.forEach(function (x) { x.setAttribute('aria-selected', String(x === o)); });
      input.value = o.textContent.trim();
      root.dispatchEvent(new CustomEvent('cv:change', { bubbles: true, detail: { value: o.dataset.value || input.value } }));
      close();
    }
    input.addEventListener('input', function () { open(); filter(); });
    input.addEventListener('keydown', function (e) {
      var expanded = inline || !list.hidden;
      if (e.key === 'ArrowDown') { e.preventDefault(); if (!expanded) { open(); filter(); } setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (!expanded) { open(); filter(); } setActive(active - 1); }
      else if (e.key === 'Enter') { var v = visible(); if (expanded && active >= 0 && v[active]) { e.preventDefault(); choose(v[active]); } }
      else if (e.key === 'Escape') { if (!inline && expanded) { e.preventDefault(); e.stopPropagation(); close(); } }
    });
    input.addEventListener('blur', function () { setTimeout(function () { if (!root.contains(document.activeElement)) close(); }, 150); });
    list.addEventListener('mousedown', function (e) { e.preventDefault(); }); /* keep focus on the input */
    list.addEventListener('click', function (e) { var o = e.target.closest('[role="option"]'); if (o) choose(o); });
    if (inline) {
      var dlg = root.closest('dialog');
      if (dlg) dlg.addEventListener('close', function () { input.value = ''; filter(); });
      filter();
    } else close();
  }

  /* ---------- Toasts ---------- */
  var ICONS = { success: 'ph-check-circle', warning: 'ph-warning', danger: 'ph-x-circle', info: 'ph-info' };
  function region() {
    var r = document.querySelector('.cv-toast-region');
    if (!r) {
      r = document.createElement('section');
      r.className = 'cv-toast-region';
      r.setAttribute('aria-label', 'Notifications');
      document.body.appendChild(r);
    }
    return r;
  }
  /* Auto-dismiss pauses while the toast is hovered or holds focus, and resumes
     with the time that was left (WCAG 2.2.1). timeout 0 = stays until dismissed. */
  function wireToast(el, timeout) {
    var btn = el.querySelector('[data-cv-dismiss]');
    var timer = null, remaining = timeout, startedAt = 0, hovered = false, focused = false;
    function remove() {
      clearTimeout(timer); timer = null;
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    function start() {
      if (timeout <= 0 || timer !== null || hovered || focused || !el.parentNode) return;
      startedAt = Date.now();
      timer = setTimeout(remove, Math.max(remaining, 0));
    }
    function pause() {
      if (timer === null) return;
      clearTimeout(timer); timer = null;
      remaining -= Date.now() - startedAt;
    }
    if (btn) btn.addEventListener('click', remove);
    if (timeout > 0) {
      el.addEventListener('mouseenter', function () { hovered = true; pause(); });
      el.addEventListener('mouseleave', function () { hovered = false; start(); });
      el.addEventListener('focusin', function () { focused = true; pause(); });
      el.addEventListener('focusout', function (e) {
        if (e.relatedTarget && el.contains(e.relatedTarget)) return; /* focus moved inside the toast */
        focused = false; start();
      });
      start();
    }
    el.dataset.cvWired = '1';
    return el;
  }
  function toast(opts) {
    opts = opts || {};
    var status = ICONS[opts.status] ? opts.status : 'info';
    var el = document.createElement('div');
    el.className = 'cv-toast cv-toast--' + status;
    el.setAttribute('role', status === 'danger' || status === 'warning' ? 'alert' : 'status');
    var icon = document.createElement('i');
    icon.className = 'ph ' + ICONS[status] + ' cv-icon';
    icon.setAttribute('aria-hidden', 'true');
    var body = document.createElement('div');
    body.className = 'cv-toast__body';
    if (opts.title) { var t = document.createElement('div'); t.className = 'cv-toast__title'; t.textContent = opts.title; body.appendChild(t); }
    if (opts.text) { var x = document.createElement('div'); x.className = 'cv-toast__text'; x.textContent = opts.text; body.appendChild(x); }
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.setAttribute('data-cv-dismiss', '');
    close.innerHTML = '<i class="ph ph-x cv-icon" aria-hidden="true"></i>';
    el.appendChild(icon); el.appendChild(body); el.appendChild(close);
    /* Errors and warnings stay until dismissed (WCAG 2.2.1); others leave after 6 s, paused on hover or focus. */
    var timeout = opts.timeout != null ? opts.timeout : (status === 'danger' || status === 'warning' ? 0 : 6000);
    region().appendChild(el);
    return wireToast(el, timeout);
  }

  /* ---------- App shell navigation (drawer below 1024 px) ---------- */
  function setNav(shell, open, focus) {
    var toggle = shell.querySelector('[data-cv-nav-toggle]');
    var nav = shell.querySelector('.cv-sidebar');
    if (open) shell.setAttribute('data-nav-open', ''); else shell.removeAttribute('data-nav-open');
    if (toggle) toggle.setAttribute('aria-expanded', String(open));
    if (focus) {
      if (open && nav) { var f = nav.querySelector(FOCUSABLE); if (f) f.focus(); }
      else if (!open && toggle) toggle.focus();
    }
  }

  /* ---------- Text size (user preference) ---------- */
  var TEXT_SIZES = ['auto', 'standard', 'comfortable', 'large'];
  function getTextSize() { return document.documentElement.getAttribute('data-text-size') || 'auto'; }
  function setTextSize(size) {
    if (TEXT_SIZES.indexOf(size) < 0) size = 'auto';
    if (size === 'auto') document.documentElement.removeAttribute('data-text-size');
    else document.documentElement.setAttribute('data-text-size', size);
    each(document, '[data-cv-text-size-control] input[type="radio"]', function (r) { r.checked = r.value === size; });
    document.dispatchEvent(new CustomEvent('cv:textsize', { detail: { size: size } }));
    return size;
  }
  function initTextSizeControl(group) {
    if (!once(group, 'cvTextSize')) return;
    var current = getTextSize();
    each(group, 'input[type="radio"]', function (r) { r.checked = r.value === current; });
    group.addEventListener('change', function (e) { if (e.target.matches('input[type="radio"]')) setTextSize(e.target.value); });
  }

  /* ---------- Delegated events ---------- */
  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-cv-open]');
    if (opener) { var d = document.getElementById(opener.getAttribute('data-cv-open')); if (d) { e.preventDefault(); initDialog(d); openDialog(d, opener); } return; }
    var closer = e.target.closest('[data-cv-close]');
    if (closer) { var dlg = closer.closest('dialog'); if (dlg) { e.preventDefault(); closeDialog(dlg, closer.value || ''); } return; }
    var navToggle = e.target.closest('[data-cv-nav-toggle]');
    if (navToggle) { var sh = navToggle.closest('.cv-shell'); if (sh) setNav(sh, !sh.hasAttribute('data-nav-open'), true); return; }
    if (e.target.classList && e.target.classList.contains('cv-shell__scrim')) { setNav(e.target.closest('.cv-shell'), false, true); }
    var static_ = e.target.closest('.cv-toast [data-cv-dismiss]');
    if (static_) { var tt = static_.closest('.cv-toast'); if (tt && !tt.dataset.cvWired && tt.parentNode) tt.parentNode.removeChild(tt); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var sh = document.querySelector('.cv-shell[data-nav-open]');
      if (sh) setNav(sh, false, true);
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      var cmd = document.querySelector('dialog[data-cv-shortcut="mod+k"]');
      if (cmd) { e.preventDefault(); initDialog(cmd); openDialog(cmd, document.activeElement); }
    }
  });

  function init(root) {
    root = root || document;
    each(root, 'dialog.cv-modal, dialog.cv-drawer, dialog.cv-cmd', initDialog);
    each(root, '.cv-menu[popover]', initMenu);
    each(root, '.cv-tooltip-wrap', initTooltip);
    each(root, '.cv-tabs', initTabs);
    each(root, '.cv-combobox', initCombobox);
    each(root, '[data-cv-text-size-control]', initTextSizeControl);
    each(root, '.cv-toast[data-cv-timeout]', function (el) {
      if (once(el, 'cvWired')) wireToast(el, parseInt(el.getAttribute('data-cv-timeout'), 10) || 0);
    });
  }

  /* ---------- Category colours: derive marker and fill from a picked colour ----------
     Keeps the hue and saturation (HSL) and moves the lightness only:
     light marker = the lightest value at 3:1 or more on every light ground,
     dark marker  = the darkest value at 3:1 or more on every dark ground,
     fill         = the lightest value that keeps white text at 4.5:1 or more.
     The grounds are read from the tokens, so the result follows any token change. */
  var CAT_GROUNDS = ['--cv-bg', '--cv-surface', '--cv-surface-2', '--cv-surface-raised'];
  var groundCache = null;
  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return null;
    var h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16) / 255; });
  }
  function rgbToHex(c) { return '#' + c.map(function (v) { return ('0' + Math.round(v * 255).toString(16)).slice(-2); }).join(''); }
  function cssRgb(s) { var m = String(s).match(/[\d.]+/g); return m ? m.slice(0, 3).map(function (v) { return v / 255; }) : null; }
  function luminance(c) {
    var f = function (v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }
  function contrast(a, b) { var x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function toHsl(c) {
    var r = c[0], g = c[1], b = c[2], max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, h = 0, s = 0, d = max - min;
    if (d) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function fromHsl(h, s, l) {
    if (!s) return [l, l, l];
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    var t = function (x) { x = (x + 1) % 1; return x < 1 / 6 ? p + (q - p) * 6 * x : x < 1 / 2 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p; };
    return [t(h + 1 / 3), t(h), t(h - 1 / 3)];
  }
  function grounds() {
    if (groundCache) return groundCache;
    var out = {};
    ['light', 'dark'].forEach(function (theme) {
      var probe = document.createElement('div');
      probe.setAttribute('data-theme', theme);
      probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden';
      document.body.appendChild(probe);
      out[theme] = CAT_GROUNDS.map(function (name) {
        probe.style.color = 'var(' + name + ')';
        return cssRgb(getComputedStyle(probe).color);
      }).filter(Boolean);
      document.body.removeChild(probe);
    });
    return (groundCache = out);
  }
  /* Search the lightness in 0.001 steps; `lightest` picks the lightest passing value, otherwise the darkest. */
  function pick(hsl, ok, lightest) {
    for (var i = 0; i <= 1000; i++) {
      var l = lightest ? 1 - i / 1000 : i / 1000, hex = rgbToHex(fromHsl(hsl[0], hsl[1], l));
      if (ok(hexToRgb(hex))) return hex; /* tested after rounding to the hex value that is applied */
    }
    return lightest ? '#000000' : '#ffffff';
  }
  function categoryColors(hex) {
    var c = hexToRgb(hex);
    if (!c) return null;
    var hsl = toHsl(c), g = grounds(), white = [1, 1, 1];
    var minOn = function (list) { return function (x) { return list.every(function (b) { return contrast(x, b) >= 3.1; }); }; };
    return {
      light: pick(hsl, minOn(g.light), true),
      dark: pick(hsl, minOn(g.dark), false),
      fill: pick(hsl, function (x) { return contrast(x, white) >= 4.6; }, true)
    };
  }
  /* setCategory(el, 1..16) uses the palette; setCategory(el, '#rrggbb') derives a custom category. */
  function setCategory(el, value) {
    if (!el) return null;
    var n = parseInt(value, 10);
    if (String(n) === String(value).trim() && n >= 1 && n <= 16) {
      el.setAttribute('data-cat', String(n));
      ['--cv-cat-custom-light', '--cv-cat-custom-dark', '--cv-cat-custom-fill'].forEach(function (p) { el.style.removeProperty(p); });
      return { cat: n };
    }
    var c = categoryColors(value);
    if (!c) return null;
    el.setAttribute('data-cat', 'custom');
    el.style.setProperty('--cv-cat-custom-light', c.light);
    el.style.setProperty('--cv-cat-custom-dark', c.dark);
    el.style.setProperty('--cv-cat-custom-fill', c.fill);
    return c;
  }

  window.Covenant = {
    __loaded: true,
    init: init,
    toast: toast,
    setTextSize: setTextSize,
    getTextSize: getTextSize,
    openDialog: function (id) { var d = typeof id === 'string' ? document.getElementById(id) : id; if (d) { initDialog(d); openDialog(d); } },
    closeDialog: function (id) { var d = typeof id === 'string' ? document.getElementById(id) : id; closeDialog(d); },
    categoryColors: categoryColors,
    setCategory: setCategory
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(document); });
  else init(document);
})();
