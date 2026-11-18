/** @import { ActiveView, InputPresentation } from '../../types.d.ts' */
/** @import { CommandPaletteItem } from './command-palette.js' */

import { DEFAULT_TOAST_DURATION_SECONDS, normalizeToastDurationSeconds } from '../../core/model.js';
import { wireCommandPalette } from './command-palette.js';
import { hideAllTooltips, initTooltips, setTooltip } from './tooltip.js';

const THEME_STORAGE_KEY = 'locavern-color-scheme';
const TEXT_SIZE_STORAGE_KEY = 'locavern-text-size';

let toastDurationMs = DEFAULT_TOAST_DURATION_SECONDS * 1000;

const supportsMenuAnchorPos =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('position-area', 'block-end');

const supportsPopoverSource =
  typeof window !== 'undefined' &&
  typeof window.ToggleEvent !== 'undefined' &&
  'source' in window.ToggleEvent.prototype;

/**
 * Configure the auto-dismiss delay (in seconds) for success and info toasts.
 * @param {number} seconds
 */
export function setToastDurationSeconds(seconds) {
  toastDurationMs = normalizeToastDurationSeconds(seconds) * 1000;
}

/**
 * Resolve current OS color scheme preference.
 * @returns {'light' | 'dark'}
 */
function getSystemScheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Apply resolved color scheme to DOM and switch control.
 * @param {'light' | 'dark' | null} override
 */
function applyScheme(override) {
  const resolved = override ?? getSystemScheme();
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute('content', override ?? 'light dark');
  }
  document.documentElement.dataset.theme = resolved;
  const sw = /** @type {HTMLInputElement | null} */ (document.getElementById('theme-switch'));
  if (sw) {
    sw.checked = resolved === 'dark';
  }
}

/**
 * Toggle between light and dark schemes following two-state system-aware persistence.
 */
export function toggleColorScheme() {
  const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const target = current === 'dark' ? 'light' : 'dark';
  const system = getSystemScheme();
  try {
    if (target === system) {
      localStorage.removeItem(THEME_STORAGE_KEY);
      applyScheme(null);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, target);
      applyScheme(target);
    }
  } catch {
    applyScheme(target);
  }
}

/**
 * Initialize light/dark theme toggle and cross-tab / OS listeners.
 */
export function initThemeControl() {
  /** @type {'light' | 'dark' | null} */
  let stored = null;
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark') stored = raw;
  } catch {
    stored = null;
  }
  applyScheme(stored);

  const sw = /** @type {HTMLInputElement | null} */ (document.getElementById('theme-switch'));
  sw?.addEventListener('change', () => toggleColorScheme());

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      if (raw !== 'light' && raw !== 'dark') applyScheme(null);
    } catch {
      applyScheme(null);
    }
  });

  window.addEventListener('storage', (event) => {
    if (event.key === THEME_STORAGE_KEY) {
      const next = event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : null;
      applyScheme(next);
    }
  });
}

/**
 * Normalize a persisted or event text size token.
 * @param {string | null | undefined} value
 * @returns {'auto' | 'standard' | 'comfortable' | 'large'}
 */
function normalizeTextSize(value) {
  return value === 'standard' || value === 'comfortable' || value === 'large' ? value : 'auto';
}

/**
 * Initialize Covenant TextSize persistence (`locavern-text-size`) and cross-tab sync.
 */
export function initTextSizeControl() {
  /** @type {'auto' | 'standard' | 'comfortable' | 'large'} */
  let stored;
  try {
    stored = normalizeTextSize(localStorage.getItem(TEXT_SIZE_STORAGE_KEY));
  } catch {
    stored = 'auto';
  }

  if (typeof window.Covenant?.setTextSize === 'function') {
    if (window.Covenant.getTextSize?.() !== stored) {
      window.Covenant.setTextSize(stored);
    }
  } else if (stored === 'auto') {
    delete document.documentElement.dataset.textSize;
  } else {
    document.documentElement.dataset.textSize = stored;
  }

  document.addEventListener('cv:textsize', (event) => {
    const custom = /** @type {CustomEvent<{ size?: string }>} */ (event);
    const next = normalizeTextSize(custom.detail?.size);
    try {
      if (next === 'auto') {
        localStorage.removeItem(TEXT_SIZE_STORAGE_KEY);
      } else {
        localStorage.setItem(TEXT_SIZE_STORAGE_KEY, next);
      }
    } catch {
      // Ignore storage access errors in restricted contexts.
    }
  });

  window.addEventListener('storage', (event) => {
    if (event.key === TEXT_SIZE_STORAGE_KEY) {
      const next = normalizeTextSize(event.newValue);
      if (typeof window.Covenant?.setTextSize === 'function') {
        if (window.Covenant.getTextSize?.() !== next) {
          window.Covenant.setTextSize(next);
        }
      } else if (next === 'auto') {
        delete document.documentElement.dataset.textSize;
      } else {
        document.documentElement.dataset.textSize = next;
      }
    }
  });
}

/**
 * Display a Covenant toast notification.
 * Success and info toasts close automatically after the configured duration;
 * warning and danger toasts stay until manually dismissed (WCAG 2.2.1).
 * @param {{ status: 'success' | 'warning' | 'danger' | 'info'; title: string; text?: string; timeout?: number }} opts
 * @returns {HTMLElement | undefined}
 */
export function notify(opts) {
  const timeout =
    opts.timeout != null
      ? opts.timeout
      : opts.status === 'danger' || opts.status === 'warning'
        ? 0
        : toastDurationMs;
  const toastEl = window.Covenant?.toast?.({ ...opts, timeout });
  if (toastEl) {
    const dismissBtn = toastEl.querySelector('[data-cv-dismiss]');
    if (dismissBtn instanceof HTMLElement) {
      dismissBtn.setAttribute('aria-label', 'Fermer la notification');
      setTooltip(dismissBtn, 'Fermer la notification');
    }
  }
  return toastEl;
}

/**
 * Position a `.cv-menu[popover]` relative to its invoker when CSS Anchor Positioning
 * is unavailable, clamping to the viewport and flipping on overflow.
 * @param {HTMLElement} menu
 * @param {HTMLElement | null} invoker
 */
function positionMenuFallback(menu, invoker) {
  if (!invoker) return;
  const r = invoker.getBoundingClientRect();
  const w = menu.offsetWidth;
  const h = menu.offsetHeight;
  const gap = 4;
  const margin = 8;

  let left = r.left;
  if (left + w > window.innerWidth - margin && r.right - w >= margin) {
    left = r.right - w;
  }
  left = Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - w - margin));

  let top = r.bottom + gap;
  if (top + h > window.innerHeight - margin && r.top - h - gap >= margin) {
    top = r.top - h - gap;
  }
  top = Math.min(Math.max(margin, top), Math.max(margin, window.innerHeight - h - margin));

  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
}

/**
 * Enhance Covenant popover menus:
 * - Dismiss open tooltips when a menu opens.
 * - Let CSS Anchor Positioning (`@supports (position-area: block-end)`) govern placement
 *   when supported with implicit source by clearing inline `left`/`top` from `covenant.js`.
 * - Keep JS fallback positioning synced on scroll/resize when unsupported.
 * @param {ParentNode} [root]
 */
function enhanceMenus(root = document) {
  root.querySelectorAll('.cv-menu[popover]').forEach((node) => {
    if (!(node instanceof HTMLElement) || node.dataset.lcMenuEnhanced === '1') return;
    node.dataset.lcMenuEnhanced = '1';

    /** @type {(() => void) | null} */
    let cleanupListeners = null;

    node.addEventListener('toggle', (event) => {
      const toggleEv = /** @type {ToggleEvent} */ (event);
      const isOpen = toggleEv.newState === 'open';

      if (!isOpen) {
        cleanupListeners?.();
        cleanupListeners = null;
        return;
      }

      hideAllTooltips();

      const invoker = node.id
        ? document.querySelector(`[popovertarget="${CSS.escape(node.id)}"]`)
        : null;
      const invokerEl = invoker instanceof HTMLElement ? invoker : null;

      if (supportsMenuAnchorPos && supportsPopoverSource) {
        node.style.left = '';
        node.style.top = '';
        return;
      }

      positionMenuFallback(node, invokerEl);
      const reposition = () => {
        if (!node.isConnected || !node.matches(':popover-open')) return;
        positionMenuFallback(node, invokerEl);
      };
      window.addEventListener('scroll', reposition, true);
      window.addEventListener('resize', reposition);
      cleanupListeners = () => {
        window.removeEventListener('scroll', reposition, true);
        window.removeEventListener('resize', reposition);
      };
    });
  });
}

/**
 * Initialize Covenant behaviours, enhanced menu positioning, and accessible tooltips on a subtree.
 * @param {ParentNode} [root]
 */
export function initCovenant(root) {
  window.Covenant?.init?.(root);
  enhanceMenus(root);
  initTooltips(root);
}

/**
 * Switch a Covenant <dialog> and its header/title/body/footer slots between drawer and modal.
 * @param {HTMLDialogElement} dialog
 * @param {InputPresentation} presentation
 */
export function applyDialogPresentation(dialog, presentation) {
  const mode = presentation === 'modal' ? 'modal' : 'drawer';
  const prev = mode === 'modal' ? 'drawer' : 'modal';

  dialog.classList.remove(`cv-${prev}`);
  dialog.classList.add(`cv-${mode}`);
  dialog.dataset.inputPresentation = mode;

  for (const part of ['header', 'title', 'body', 'footer']) {
    const slot = dialog.querySelector(`.cv-drawer__${part}, .cv-modal__${part}`);
    if (slot) {
      slot.classList.remove(`cv-${prev}__${part}`);
      slot.classList.add(`cv-${mode}__${part}`);
    }
  }
}

/**
 * Open a Covenant modal or drawer dialog by id.
 * @param {string} id
 */
export function openDialogById(id) {
  hideAllTooltips();
  if (typeof window.Covenant?.openDialog === 'function') {
    window.Covenant.openDialog(id);
  } else {
    const dlg = /** @type {HTMLDialogElement | null} */ (document.getElementById(id));
    if (dlg && !dlg.open) dlg.showModal();
  }
  const dlg = document.getElementById(id);
  if (dlg) {
    initTooltips(dlg);
  }
}

/**
 * Close a Covenant modal or drawer dialog by id.
 * @param {string} id
 */
export function closeDialogById(id) {
  hideAllTooltips();
  if (typeof window.Covenant?.closeDialog === 'function') {
    window.Covenant.closeDialog(id);
  } else {
    const dlg = /** @type {HTMLDialogElement | null} */ (document.getElementById(id));
    if (dlg && dlg.open) dlg.close();
  }
}

/**
 * Open the shared Covenant confirmation modal for destructive or overwriting actions.
 * Puts autofocus on Cancel (safe default).
 * @param {{ title: string; message: string; confirmLabel: string; danger?: boolean }} opts
 * @returns {Promise<boolean>}
 */
export function confirmAction({ title, message, confirmLabel, danger = true }) {
  const dialog = /** @type {HTMLDialogElement | null} */ (document.getElementById('modal-confirm'));
  const titleEl = document.getElementById('modal-confirm-title');
  const bodyEl = document.getElementById('modal-confirm-body');
  const footerEl = document.getElementById('modal-confirm-footer');
  if (!dialog || !titleEl || !bodyEl || !footerEl) {
    return Promise.resolve(false);
  }

  titleEl.textContent = title;
  const p = document.createElement('p');
  p.textContent = message;
  bodyEl.replaceChildren(p);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'cv-btn';
  cancelBtn.setAttribute('data-cv-close', '');
  cancelBtn.value = 'cancel';
  cancelBtn.autofocus = true;
  cancelBtn.textContent = 'Annuler';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = danger ? 'cv-btn cv-btn--danger' : 'cv-btn cv-btn--primary';
  confirmBtn.setAttribute('data-cv-close', '');
  confirmBtn.value = 'confirm';
  confirmBtn.textContent = confirmLabel;

  footerEl.replaceChildren(cancelBtn, confirmBtn);

  return new Promise((resolve) => {
    const onClose = () => {
      const accepted = dialog.returnValue === 'confirm';
      dialog.returnValue = '';
      dialog.removeEventListener('close', onClose);
      resolve(accepted);
    };
    dialog.addEventListener('close', onClose);
    openDialogById('modal-confirm');
    cancelBtn.focus();
  });
}

/** @type {Record<ActiveView, string>} */
const VIEW_TITLES = {
  today: 'Aujourd’hui',
  tasks: 'Tâches',
  projects: 'Projets',
  calendar: 'Calendrier',
  notes: 'Notes',
  whiteboards: 'Tableaux blancs',
  archives: 'Archives',
};

/**
 * Sync TopBar title, document <title>, and sidebar aria-current link.
 * @param {ActiveView} activeView
 */
export function syncNavigationChrome(activeView) {
  const label = VIEW_TITLES[activeView] ?? 'Tâches';
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = label;
  document.title = `${label} · Locavern`;

  document.querySelectorAll('[data-nav-view]').forEach((node) => {
    if (node.getAttribute('data-nav-view') === activeView) {
      node.setAttribute('aria-current', 'page');
    } else {
      node.removeAttribute('aria-current');
    }
  });
}

/**
 * Render or clear the offline Service Worker update notification inviting the user to reload.
 * @param {boolean} available
 * @param {{ onReload: () => void; onDismiss?: () => void }} [handlers]
 */
export function renderSwUpdateBanner(available, handlers) {
  const slot = document.getElementById('sw-update-slot');
  if (!slot) return;
  if (!available || !handlers) {
    slot.replaceChildren();
    return;
  }

  const alert = document.createElement('div');
  alert.className = 'cv-alert';
  alert.id = 'sw-update-banner';
  alert.setAttribute('role', 'status');

  const icon = document.createElement('i');
  icon.className = 'ph ph-arrows-clockwise cv-icon';
  icon.setAttribute('aria-hidden', 'true');

  const body = document.createElement('div');
  body.className = 'cv-alert__body cv-field';

  const textWrap = document.createElement('div');
  const lead = document.createElement('span');
  lead.className = 'cv-alert__title';
  lead.textContent = 'Nouvelle version prête hors ligne. ';
  textWrap.append(
    lead,
    document.createTextNode('Rechargez l’application pour utiliser la version mise à jour.'),
  );

  const actions = document.createElement('div');
  actions.className = 'lc-view-header__group';

  const reloadBtn = document.createElement('button');
  reloadBtn.type = 'button';
  reloadBtn.className = 'cv-btn cv-btn--primary cv-btn--sm';
  reloadBtn.id = 'btn-sw-reload';
  reloadBtn.textContent = 'Recharger';
  reloadBtn.addEventListener('click', () => {
    reloadBtn.disabled = true;
    reloadBtn.textContent = 'Rechargement…';
    handlers.onReload();
  });

  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.className = 'cv-btn cv-btn--sm';
  dismissBtn.id = 'btn-sw-dismiss';
  dismissBtn.textContent = 'Plus tard';
  dismissBtn.addEventListener('click', () => {
    slot.replaceChildren();
    handlers.onDismiss?.();
  });

  actions.append(reloadBtn, dismissBtn);
  body.append(textWrap, actions);
  alert.append(icon, body);
  slot.replaceChildren(alert);
}

/**
 * Render or clear the read-only alert banner when another tab holds the Web Lock.
 * @param {boolean} readOnly
 * @param {() => void} onRetryLock
 */
export function renderReadOnlyBanner(readOnly, onRetryLock) {
  const slot = document.getElementById('readonly-banner-slot');
  if (!slot) return;
  if (!readOnly) {
    slot.replaceChildren();
    return;
  }

  const alert = document.createElement('div');
  alert.className = 'cv-alert cv-alert--warning';
  alert.setAttribute('role', 'status');

  const icon = document.createElement('i');
  icon.className = 'ph ph-warning cv-icon';
  icon.setAttribute('aria-hidden', 'true');

  const body = document.createElement('div');
  body.className = 'cv-alert__body';
  const lead = document.createElement('span');
  lead.className = 'cv-alert__title';
  lead.textContent = 'Mode lecture seule actif. ';
  body.append(
    lead,
    document.createTextNode(
      'Un autre onglet détient le verrou d’écriture sur la base locale. Fermez l’autre onglet puis réessayez pour modifier vos données.',
    ),
  );

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'cv-btn cv-btn--sm';
  retryBtn.textContent = 'Reprendre l’édition';
  retryBtn.addEventListener('click', onRetryLock);

  alert.append(icon, body, retryBtn);
  slot.replaceChildren(alert);
}

/**
 * Wire sidebar navigation links and CommandMenu (Ctrl+K / Cmd+K) actions.
 * @param {{ onSelectView: (view: ActiveView) => void; onCommand: (commandId: string) => void; getCommandItems?: () => CommandPaletteItem[]; }} handlers
 */
export function wireAppShell({ onSelectView, onCommand, getCommandItems }) {
  initThemeControl();
  initTextSizeControl();

  document.querySelectorAll('[data-nav-view]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const target = /** @type {ActiveView | null} */ (link.getAttribute('data-nav-view'));
      if (target) {
        onSelectView(target);
        const shell = document.querySelector('.cv-shell');
        if (shell?.hasAttribute('data-nav-open')) {
          shell.removeAttribute('data-nav-open');
          const toggle = shell.querySelector('[data-cv-nav-toggle]');
          toggle?.setAttribute('aria-expanded', 'false');
        }
      }
    });
  });

  wireCommandPalette({ getDynamicItems: getCommandItems });

  const cmdDialog = document.getElementById('cmd-menu');
  cmdDialog?.addEventListener('cv:command', (event) => {
    const custom = /** @type {CustomEvent<{ value?: string }>} */ (event);
    const value = custom.detail?.value;
    if (value) onCommand(value);
  });
}
