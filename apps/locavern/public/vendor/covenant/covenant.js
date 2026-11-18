/* @ds-bundle: {"format":4,"namespace":"Covenant","components":[]} */
/* Covenant Design System — behaviours (Vanilla Web, no dependency).
   Native HTML first: <dialog> for modals, drawers and the command menu, the
   popover attribute for menus, native inputs for dates. This script only adds
   what the platform does not provide. Load once; it initialises itself and
   exposes window.Covenant = { init, toast, setTextSize, getTextSize, openDialog, closeDialog }. */
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
  function wireToast(el, timeout) {
    var btn = el.querySelector('[data-cv-dismiss]');
    var timer = null;
    var remaining = timeout;
    var startedAt = 0;
    var hovered = false;
    var focused = false;
    function remove() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    function pause() {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
      remaining = Math.max(0, remaining - (Date.now() - startedAt));
    }
    function resume() {
      if (timer || hovered || focused || !el.parentNode) return;
      startedAt = Date.now();
      timer = setTimeout(remove, remaining);
    }
    if (btn) btn.addEventListener('click', remove);
    if (timeout > 0) {
      startedAt = Date.now();
      timer = setTimeout(remove, timeout);
      el.addEventListener('mouseenter', function () { hovered = true; pause(); });
      el.addEventListener('mouseleave', function () { hovered = false; resume(); });
      el.addEventListener('focusin', function () { focused = true; pause(); });
      el.addEventListener('focusout', function (e) {
        if (!e.relatedTarget || !el.contains(e.relatedTarget)) {
          focused = false;
          resume();
        }
      });
    }
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

  window.Covenant = {
    __loaded: true,
    init: init,
    toast: toast,
    setTextSize: setTextSize,
    getTextSize: getTextSize,
    openDialog: function (id) { var d = typeof id === 'string' ? document.getElementById(id) : id; if (d) { initDialog(d); openDialog(d); } },
    closeDialog: function (id) { var d = typeof id === 'string' ? document.getElementById(id) : id; closeDialog(d); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(document); });
  else init(document);
})();
