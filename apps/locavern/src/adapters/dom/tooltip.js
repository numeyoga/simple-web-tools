/**
 * Accessible top-layer tooltips built on `popover="hint"` + `interestfor` semantics
 * (WCAG 1.4.13 dismissible, hoverable, persistent; Covenant tokens; zero external deps).
 */

const HOVER_SHOW_DELAY_MS = 300;
const HOVER_HIDE_DELAY_MS = 150;

let tipUid = 0;
let globalsWired = false;
let lastPointerAt = 0;
let lastKeyAt = 0;
let suppressDialogCancelUntil = 0;

/** @type {HTMLElement | null} */
let activeTrigger = null;
/** @type {HTMLElement | null} */
let activeTip = null;

/** @type {WeakMap<HTMLElement, HTMLElement>} */
const triggerToTip = new WeakMap();
/** @type {WeakMap<HTMLElement, HTMLElement>} */
const tipToTrigger = new WeakMap();
/** @type {WeakMap<HTMLElement, Set<string>>} */
const ownedDescribedBy = new WeakMap();
/** @type {WeakMap<HTMLElement, string>} */
const ownedLabelledBy = new WeakMap();
/** @type {WeakMap<HTMLElement, { showTimer: number | null; hideTimer: number | null }>} */
const timerMap = new WeakMap();
/** @type {WeakMap<HTMLElement, { hover: boolean; focus: boolean }>} */
const dismissedMap = new WeakMap();

const supportsInterestFor =
  typeof HTMLButtonElement !== 'undefined' && 'interestForElement' in HTMLButtonElement.prototype;

const supportsAnchorPos =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('position-area', 'block-start');

const supportsToggleSource =
  typeof window !== 'undefined' &&
  typeof window.ToggleEvent !== 'undefined' &&
  'source' in window.ToggleEvent.prototype;

const useCssAnchor = supportsAnchorPos && (supportsInterestFor || supportsToggleSource);

/** @param {string | null | undefined} value */
function normalizeText(value) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** @param {HTMLElement} el */
function isPopoverOpen(el) {
  try {
    return el.matches(':popover-open') || el.classList.contains(':popover-open');
  } catch {
    return el.classList.contains(':popover-open');
  }
}

/** @param {HTMLElement} trigger */
function getTimers(trigger) {
  let entry = timerMap.get(trigger);
  if (!entry) {
    entry = { showTimer: null, hideTimer: null };
    timerMap.set(trigger, entry);
  }
  return entry;
}

/** @param {HTMLElement} trigger */
function getDismissed(trigger) {
  let entry = dismissedMap.get(trigger);
  if (!entry) {
    entry = { hover: false, focus: false };
    dismissedMap.set(trigger, entry);
  }
  return entry;
}

/** @param {HTMLElement} trigger */
function clearTimers(trigger) {
  const t = timerMap.get(trigger);
  if (!t) return;
  if (t.showTimer !== null) {
    window.clearTimeout(t.showTimer);
    t.showTimer = null;
  }
  if (t.hideTimer !== null) {
    window.clearTimeout(t.hideTimer);
    t.hideTimer = null;
  }
}

/**
 * Resolve the accessible name text of a trigger (without relying on a tooltip description).
 * @param {HTMLElement} trigger
 * @param {string} ignoreTipId
 */
function getTriggerAccessibleName(trigger, ignoreTipId) {
  const labelledBy = trigger.getAttribute('aria-labelledby');
  if (labelledBy) {
    const parts = labelledBy
      .split(/\s+/)
      .filter((id) => id && id !== ignoreTipId)
      .map((id) => normalizeText(document.getElementById(id)?.textContent));
    const joined = normalizeText(parts.join(' '));
    if (joined) return joined;
  }
  const ariaLabel = normalizeText(trigger.getAttribute('aria-label'));
  if (ariaLabel) return ariaLabel;

  // Read visible text nodes + img alt, skipping aria-hidden children
  /** @param {Node} node @returns {string} */
  const collectText = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = /** @type {Element} */ (node);
    if (el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('hidden')) return '';
    if (el.tagName === 'IMG') return el.getAttribute('alt') ?? '';
    let out = '';
    for (const child of el.childNodes) {
      out += collectText(child);
    }
    return out;
  };
  const visible = normalizeText(collectText(trigger));
  if (visible) return visible;

  return normalizeText(trigger.getAttribute('title'));
}

/**
 * Sync ARIA attributes cleanly:
 * - If hint text equals the trigger's accessible name, add nothing (no duplicate announcement).
 * - If trigger has no accessible name, link `aria-labelledby`.
 * - Otherwise add `role="tooltip"` on the hint and link `aria-describedby`.
 * @param {HTMLElement} trigger
 * @param {HTMLElement} tip
 */
function syncTooltipAria(trigger, tip) {
  if (!tip.id) {
    tipUid += 1;
    tip.id = `lc-tip-${tipUid}`;
  }
  const tipText = normalizeText(tip.textContent);
  const accName = getTriggerAccessibleName(trigger, tip.id);

  // Clean up any prior auto-managed ARIA links for this tip id
  const ownedDesc = ownedDescribedBy.get(trigger);
  if (ownedDesc?.has(tip.id)) {
    const tokens = (trigger.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter((id) => id && id !== tip.id);
    if (tokens.length > 0) {
      trigger.setAttribute('aria-describedby', tokens.join(' '));
    } else {
      trigger.removeAttribute('aria-describedby');
    }
    ownedDesc.delete(tip.id);
  }
  if (ownedLabelledBy.get(trigger) === tip.id) {
    if (trigger.getAttribute('aria-labelledby') === tip.id) {
      trigger.removeAttribute('aria-labelledby');
    }
    ownedLabelledBy.delete(trigger);
  }

  if (!tipText) return;

  if (accName && tipText.toLowerCase() === accName.toLowerCase()) {
    if (tip.dataset.lcOwnedRole === '1') {
      tip.removeAttribute('role');
      delete tip.dataset.lcOwnedRole;
    }
    return;
  }

  if (!tip.hasAttribute('role')) {
    tip.setAttribute('role', 'tooltip');
    tip.dataset.lcOwnedRole = '1';
  }

  if (!accName) {
    if (!trigger.hasAttribute('aria-labelledby')) {
      trigger.setAttribute('aria-labelledby', tip.id);
      ownedLabelledBy.set(trigger, tip.id);
    }
    return;
  }

  const existingDesc = (trigger.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(Boolean);
  if (!existingDesc.includes(tip.id)) {
    existingDesc.push(tip.id);
    trigger.setAttribute('aria-describedby', existingDesc.join(' '));
    let set = ownedDescribedBy.get(trigger);
    if (!set) {
      set = new Set();
      ownedDescribedBy.set(trigger, set);
    }
    set.add(tip.id);
  }
}

/**
 * Fallback viewport-aware positioning for browsers without CSS Anchor Positioning
 * or `ToggleEvent.prototype.source`.
 * @param {HTMLElement} tip
 * @param {HTMLElement} trigger
 */
function positionTooltipFallback(tip, trigger) {
  const r = trigger.getBoundingClientRect();
  tip.style.position = 'fixed';
  tip.style.inset = 'auto';
  tip.style.margin = '0';

  const tipRect = tip.getBoundingClientRect();
  const w = tipRect.width || tip.offsetWidth;
  const h = tipRect.height || tip.offsetHeight;
  const gap = 6;
  const margin = 8;

  const left = Math.min(
    Math.max(margin, r.left + r.width / 2 - w / 2),
    Math.max(margin, window.innerWidth - w - margin),
  );
  let top = r.top - h - gap;
  if (top < margin) {
    top = Math.min(
      Math.max(margin, r.bottom + gap),
      Math.max(margin, window.innerHeight - h - margin),
    );
  }

  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

/**
 * @param {HTMLElement} tip
 */
function closePopoverSafely(tip) {
  if (!isPopoverOpen(tip)) return;
  try {
    if (typeof tip.hidePopover === 'function') {
      tip.hidePopover();
    } else {
      tip.classList.remove(':popover-open');
    }
  } catch {
    tip.classList.remove(':popover-open');
  }
}

/**
 * @param {HTMLElement} trigger
 * @param {HTMLElement} tip
 */
function showTooltip(trigger, tip) {
  if (!trigger.isConnected || !tip.isConnected) return;
  if (trigger instanceof HTMLButtonElement && trigger.disabled) return;
  if (trigger.getAttribute('aria-disabled') === 'true') return;
  if (trigger.getAttribute('aria-expanded') === 'true') return;

  if (activeTip && activeTip !== tip) {
    if (activeTrigger) clearTimers(activeTrigger);
    closePopoverSafely(activeTip);
  }

  activeTrigger = trigger;
  activeTip = tip;

  if (!isPopoverOpen(tip)) {
    try {
      if (typeof tip.showPopover === 'function') {
        tip.showPopover(supportsToggleSource ? { source: trigger } : undefined);
      } else {
        tip.classList.add(':popover-open');
      }
    } catch {
      try {
        tip.showPopover();
      } catch {
        return;
      }
    }
  }

  if (!useCssAnchor) {
    positionTooltipFallback(tip, trigger);
  }
}

/**
 * @param {HTMLElement | null} trigger
 * @param {HTMLElement | null} tip
 */
function hideTooltip(trigger, tip) {
  if (trigger) clearTimers(trigger);
  if (tip) closePopoverSafely(tip);
  if (activeTip === tip) {
    activeTip = null;
    activeTrigger = null;
  }
}

/**
 * Hide any open tooltip immediately (e.g. when opening a menu/dialog or switching views).
 */
export function hideAllTooltips() {
  if (activeTip || activeTrigger) {
    hideTooltip(activeTrigger, activeTip);
  }
  document.querySelectorAll('.lc-tooltip[popover]').forEach((node) => {
    if (node instanceof HTMLElement && isPopoverOpen(node)) {
      closePopoverSafely(node);
    }
  });
}

function findOpenTooltip() {
  if (activeTip && isPopoverOpen(activeTip)) return activeTip;
  for (const node of document.querySelectorAll('.lc-tooltip[popover]')) {
    if (node instanceof HTMLElement && isPopoverOpen(node)) {
      return node;
    }
  }
  return null;
}

function dismissOpenTooltipOnEscape() {
  const openTip = findOpenTooltip();
  if (!openTip) return false;
  const trigger = activeTrigger ?? tipToTrigger.get(openTip) ?? null;
  if (trigger) {
    const d = getDismissed(trigger);
    if (trigger.matches(':hover')) d.hover = true;
    if (document.activeElement === trigger) d.focus = true;
  }
  hideTooltip(trigger, openTip);
  return true;
}

function ensureGlobalListeners() {
  if (globalsWired || typeof window === 'undefined') return;
  globalsWired = true;

  document.addEventListener(
    'toggle',
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.classList.contains('lc-tooltip')) return;
      const toggleEv = /** @type {ToggleEvent} */ (event);
      const trigger = tipToTrigger.get(target) ?? null;
      if (toggleEv.newState === 'open') {
        activeTip = target;
        activeTrigger = trigger;
      } else if (activeTip === target) {
        activeTip = null;
        activeTrigger = null;
      }
    },
    true,
  );

  window.addEventListener(
    'pointerdown',
    (event) => {
      lastPointerAt = Date.now();
      if (!activeTip || !isPopoverOpen(activeTip)) return;
      const target = event.target instanceof Node ? event.target : null;
      if (target && activeTip.contains(target)) return;
      if (target && activeTrigger?.contains(target)) return;
      hideTooltip(activeTrigger, activeTip);
    },
    true,
  );

  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') {
        if (dismissOpenTooltipOnEscape()) {
          suppressDialogCancelUntil = Date.now() + 400;
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        return;
      }
      if (
        event.key === 'Tab' ||
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown' ||
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight' ||
        event.key === 'Home' ||
        event.key === 'End' ||
        event.key === 'Shift'
      ) {
        lastKeyAt = Date.now();
      }
    },
    true,
  );

  window.addEventListener(
    'keyup',
    (event) => {
      if (event.key === 'Escape' && Date.now() <= suppressDialogCancelUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true,
  );

  window.addEventListener(
    'cancel',
    (event) => {
      if (!(event.target instanceof HTMLDialogElement)) return;
      if (Date.now() <= suppressDialogCancelUntil || dismissOpenTooltipOnEscape()) {
        suppressDialogCancelUntil = 0;
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );

  window.addEventListener(
    'scroll',
    () => {
      if (!activeTip || !activeTrigger || !isPopoverOpen(activeTip)) return;
      if (!activeTrigger.isConnected || !activeTip.isConnected) {
        hideTooltip(activeTrigger, activeTip);
        return;
      }
      const r = activeTrigger.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) {
        hideTooltip(activeTrigger, activeTip);
        return;
      }
      if (!useCssAnchor) {
        positionTooltipFallback(activeTip, activeTrigger);
      }
    },
    true,
  );

  window.addEventListener('resize', () => {
    if (!activeTip || !activeTrigger || !isPopoverOpen(activeTip)) return;
    if (!useCssAnchor) {
      positionTooltipFallback(activeTip, activeTrigger);
    }
  });
}

/**
 * Find or create the `<div popover="hint" class="lc-tooltip">` element for a trigger,
 * place it immediately after the trigger (or after an adjacent menu popover owned by the trigger),
 * wire ARIA upfront, and bind interaction listeners once.
 * @param {HTMLElement} trigger
 */
function wireTrigger(trigger) {
  const tipText = normalizeText(trigger.dataset.lcTooltip);
  let tip = triggerToTip.get(trigger) ?? null;

  if (!tip) {
    const existingId = trigger.getAttribute('interestfor');
    if (existingId) {
      const candidate = document.getElementById(existingId);
      if (candidate instanceof HTMLElement) {
        tip = candidate;
      }
    }
  }

  if (!tip) {
    if (!tipText) return;
    tip = document.createElement('div');
    tipUid += 1;
    tip.id = `lc-tip-${tipUid}`;
    tip.setAttribute('popover', 'hint');
    tip.className = 'lc-tooltip';
    tip.textContent = tipText;
    if (useCssAnchor) {
      tip.dataset.lcAnchorCss = 'true';
    }
    trigger.setAttribute('interestfor', tip.id);
    // Keep any popover menu (`popovertarget` / `commandfor`) as the immediate next sibling
    const popId = trigger.getAttribute('popovertarget') || trigger.getAttribute('commandfor');
    const nextEl = trigger.nextElementSibling;
    if (popId && nextEl instanceof HTMLElement && nextEl.id === popId) {
      nextEl.after(tip);
    } else {
      trigger.after(tip);
    }
  } else {
    if (tipText && normalizeText(tip.textContent) !== tipText) {
      tip.textContent = tipText;
    }
    if (useCssAnchor) {
      tip.dataset.lcAnchorCss = 'true';
    }
    if (!tip.id) {
      tipUid += 1;
      tip.id = `lc-tip-${tipUid}`;
    }
    if (!trigger.hasAttribute('interestfor')) {
      trigger.setAttribute('interestfor', tip.id);
    }
  }

  triggerToTip.set(trigger, tip);
  tipToTrigger.set(tip, trigger);
  syncTooltipAria(trigger, tip);

  if (trigger.dataset.lcTipWired === '1') return;
  trigger.dataset.lcTipWired = '1';

  const currentTip = tip;

  if (supportsInterestFor) {
    // Native `interestfor` manages hover/focus/hide; close on click/activation so it never covers menus/dialogs
    trigger.addEventListener('pointerdown', () => hideTooltip(trigger, currentTip));
    trigger.addEventListener('click', () => hideTooltip(trigger, currentTip));
    return;
  }

  /** @param {number} delayMs */
  const scheduleShow = (delayMs) => {
    const t = getTimers(trigger);
    if (t.hideTimer !== null) {
      window.clearTimeout(t.hideTimer);
      t.hideTimer = null;
    }
    if (t.showTimer !== null) {
      window.clearTimeout(t.showTimer);
      t.showTimer = null;
    }
    if (delayMs <= 0) {
      showTooltip(trigger, currentTip);
      return;
    }
    t.showTimer = window.setTimeout(() => {
      t.showTimer = null;
      if (trigger.matches(':hover')) {
        showTooltip(trigger, currentTip);
      }
    }, delayMs);
  };

  const scheduleHide = () => {
    const t = getTimers(trigger);
    if (t.showTimer !== null) {
      window.clearTimeout(t.showTimer);
      t.showTimer = null;
    }
    if (t.hideTimer !== null) {
      window.clearTimeout(t.hideTimer);
    }
    t.hideTimer = window.setTimeout(() => {
      t.hideTimer = null;
      const hoveringTrigger = trigger.matches(':hover');
      const hoveringTip = currentTip.matches(':hover');
      const focusedTrigger =
        document.activeElement === trigger &&
        !getDismissed(trigger).focus &&
        trigger.matches(':focus-visible');
      if (!hoveringTrigger && !hoveringTip && !focusedTrigger) {
        hideTooltip(trigger, currentTip);
      }
    }, HOVER_HIDE_DELAY_MS);
  };

  trigger.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch') return;
    const d = getDismissed(trigger);
    if (d.hover) return;
    scheduleShow(HOVER_SHOW_DELAY_MS);
  });

  trigger.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'touch') return;
    getDismissed(trigger).hover = false;
    scheduleHide();
  });

  trigger.addEventListener('focusin', () => {
    const d = getDismissed(trigger);
    if (d.focus) return;
    const viaKeyboard =
      trigger.matches(':focus-visible') ||
      lastKeyAt > lastPointerAt ||
      Date.now() - lastPointerAt > 250;
    if (viaKeyboard) {
      scheduleShow(0);
    }
  });

  trigger.addEventListener('focusout', () => {
    getDismissed(trigger).focus = false;
    scheduleHide();
  });

  trigger.addEventListener('pointerdown', () => {
    const d = getDismissed(trigger);
    d.hover = true;
    d.focus = true;
    hideTooltip(trigger, currentTip);
  });

  trigger.addEventListener('click', () => {
    hideTooltip(trigger, currentTip);
  });

  currentTip.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch') return;
    const t = getTimers(trigger);
    if (t.hideTimer !== null) {
      window.clearTimeout(t.hideTimer);
      t.hideTimer = null;
    }
  });

  currentTip.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'touch') return;
    scheduleHide();
  });
}

/**
 * Attach or update an accessible tooltip on a button or control.
 * If the control is not yet connected to the DOM, call `initTooltips(container)` once mounted.
 * @param {HTMLElement | null | undefined} trigger
 * @param {string} text
 */
export function setTooltip(trigger, text) {
  if (!trigger) return;
  const clean = normalizeText(text);
  if (!clean) {
    delete trigger.dataset.lcTooltip;
    return;
  }
  trigger.dataset.lcTooltip = clean;
  if (trigger.hasAttribute('title')) {
    trigger.removeAttribute('title');
  }
  const existing = triggerToTip.get(trigger);
  if (existing) {
    existing.textContent = clean;
    syncTooltipAria(trigger, existing);
    if (isPopoverOpen(existing) && !useCssAnchor) {
      positionTooltipFallback(existing, trigger);
    }
    return;
  }
  if (trigger.isConnected) {
    ensureGlobalListeners();
    wireTrigger(trigger);
  }
}

/**
 * Initialize all tooltips inside `root` synchronously (for upfront ARIA + hover/focus wiring).
 * @param {ParentNode} [root]
 */
export function initTooltips(root = document) {
  ensureGlobalListeners();
  const triggers = root.querySelectorAll('[data-lc-tooltip], [interestfor]');
  triggers.forEach((node) => {
    if (node instanceof HTMLElement && node.isConnected) {
      wireTrigger(node);
    }
  });
}
