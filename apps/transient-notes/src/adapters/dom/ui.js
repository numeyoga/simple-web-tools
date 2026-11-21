// Thin helpers that emit Covenant markup: the Anatomy of each component page of the skill, with
// its classes, roles and ARIA links. The look and the behaviours come from
// `@simple-web-tools/covenant`; nothing here styles a component.
// Every helper returns an HTMLElement.

import { appendChildren, el, fieldId, icon, t } from './lib.js';
import { liftTooltip } from './tooltip.js';

/** @typedef {import('./types.js').ButtonOptions} ButtonOptions */
/** @typedef {import('./types.js').IconButtonOptions} IconButtonOptions */
/** @typedef {import('./types.js').InputOptions} InputOptions */
/** @typedef {import('./types.js').SelectOptions} SelectOptions */
/** @typedef {import('./types.js').BadgeOptions} BadgeOptions */
/** @typedef {import('./types.js').ModalOptions} ModalOptions */
/** @typedef {import('./types.js').ModalHandle} ModalHandle */
/** @typedef {import('./types.js').ConfirmOptions} ConfirmOptions */
/** @typedef {import('./types.js').ToastOptions} ToastOptions */
/** @typedef {import('./types.js').Child} Child */

export * from './lib.js';

/** Wires the Covenant behaviours (tooltips, dialogs, comboboxes) of markup built here. */
/** @param {ParentNode} root */
export function initCovenant(root) {
  window.Covenant?.init?.(root);
}

/* ------------------ Button ------------------ */
/** @type {Record<string, string>} */
const BUTTON_VARIANTS = {
  secondary: '',
  primary: ' cv-btn--primary',
  ghost: ' cv-btn--ghost',
  danger: ' cv-btn--danger',
};

/** @param {ButtonOptions} [opts] */
function Button(opts = {}) {
  const {
    variant = 'secondary',
    size = 'md',
    icon: iconName,
    children,
    disabled,
    onclick,
    type = 'button',
    className,
    mutates,
    autoFocus,
  } = opts;
  const btn = el(
    'button',
    {
      type,
      disabled,
      autofocus: autoFocus,
      'data-mutates': mutates ? '' : null,
      class: `cv-btn${BUTTON_VARIANTS[variant] ?? ''}${size === 'sm' ? ' cv-btn--sm' : ''}${className ? ' ' + className : ''}`,
      onclick: disabled ? null : onclick,
    },
    iconName ? icon(iconName) : null,
  );
  if (children != null) appendChildren(btn, [children]);
  return btn;
}

/* ------------------ IconButton + Tooltip ------------------ */
/**
 * An icon-only button: `aria-label` names it and a Tooltip shows the same name. Returns the
 * tooltip wrapper; the button is `wrapper.button`.
 * @param {IconButtonOptions} opts
 * @returns {import('./types.js').IconButtonElement}
 */
function IconButton(opts) {
  const {
    icon: iconName,
    label,
    onclick,
    variant = 'ghost',
    size = 'md',
    disabled,
    weight,
    mutates,
    className,
  } = opts;
  const button = el(
    'button',
    {
      type: 'button',
      'aria-label': label,
      disabled,
      'data-mutates': mutates ? '' : null,
      class: `cv-btn cv-btn--icon${BUTTON_VARIANTS[variant] ?? ''}${size === 'sm' ? ' cv-btn--sm' : ''}${className ? ' ' + className : ''}`,
      onclick: disabled ? null : onclick,
    },
    icon(iconName, { weight }),
  );
  const wrap = el(
    'span',
    { class: 'cv-tooltip-wrap' },
    button,
    el('span', { class: 'cv-tooltip', role: 'tooltip', hidden: true }, label),
  );
  // Covenant.init wires the components below the node it is given, never the node itself:
  // a fragment holds the wrapper while it is wired.
  const holder = document.createDocumentFragment();
  holder.append(wrap);
  initCovenant(holder);
  liftTooltip(wrap); // out of the clipping of the sidebar and the panes (top layer)
  return Object.assign(wrap, { button });
}

/* ------------------ Menu ------------------ */
/**
 * A menu button and its popover (the Menu anatomy): the native popover API opens it, Covenant
 * positions it, moves the focus into it and handles the arrow keys. The invoker must be in the
 * document when `Covenant.init` runs on the menu, so the owner calls `initCovenant` on a
 * container once the host is attached.
 * @param {import('./types.js').MenuOptions} opts
 * @returns {import('./types.js').MenuHost}
 */
function Menu(opts) {
  const { label, menuLabel = label, icon: iconName, text, items, size = 'md' } = opts;
  const menuId = fieldId('tn-menu');
  /** @type {HTMLButtonElement} */
  let button;
  /** @type {HTMLElement} */
  let trigger;
  if (text) {
    // A visible text names the button: the aria-label repeats it (WCAG 2.5.3).
    const textNode = el('span', { class: 'tn-btn-label' }, text);
    button = Button({ icon: iconName, children: textNode, size });
    button.setAttribute('aria-label', label);
    trigger = button;
  } else {
    const wrap = IconButton({ icon: iconName, label, size });
    button = wrap.button;
    trigger = wrap;
  }
  button.setAttribute('popovertarget', menuId);
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  const menu = el(
    'div',
    { class: 'cv-menu', id: menuId, popover: '', role: 'menu', 'aria-label': menuLabel },
    items.map((item) => {
      if ('separator' in item) return el('hr', { class: 'cv-menu__sep' });
      return el(
        'button',
        {
          type: 'button',
          class: `cv-menu__item${item.danger ? ' cv-menu__item--danger' : ''}`,
          role: 'menuitem',
          'data-mutates': item.mutates ? '' : null,
          onclick: item.onclick,
        },
        icon(item.icon),
        item.label,
      );
    }),
  );
  const host = el('span', { class: 'tn-menu-host' }, trigger, menu);
  return Object.assign(host, { button, menu });
}

/* ------------------ FormField ------------------ */
/**
 * The FormField anatomy around one control: label, control, hint and error, linked with
 * `for`, `aria-describedby` and `aria-invalid`. `setError` shows or clears the error text.
 * @template {HTMLElement} T
 * @param {{ label?: string, ariaLabel?: string, required?: boolean, control: T, controlId: string,
 *   hint?: string | null, className?: string, wrapControl?: (control: T) => Node,
 *   header?: Child }} options
 * @returns {import('./types.js').Field<T>}
 */
function field({
  label,
  ariaLabel,
  required,
  control,
  controlId,
  hint,
  className,
  wrapControl,
  header,
}) {
  const hintId = hint ? fieldId('tn-hint') : null;
  const errorId = fieldId('tn-error');
  control.id = controlId;
  if (ariaLabel && !label) control.setAttribute('aria-label', ariaLabel);
  const errorText = el('span');
  const errorNode = el(
    'span',
    { class: 'cv-error', id: errorId, hidden: true },
    icon('warning-circle'),
    errorText,
  );
  const describedBy = [hintId, errorId].filter(Boolean).join(' ');
  control.setAttribute('aria-describedby', describedBy);
  const wrapper = el(
    'div',
    { class: `cv-field${className ? ' ' + className : ''}` },
    label || header
      ? el(
          'div',
          { class: header ? 'tn-row tn-gap-3 tn-baseline' : null },
          label
            ? el(
                'label',
                { class: 'cv-label', for: controlId },
                label,
                required ? el('span', { class: 'cv-required', 'aria-hidden': 'true' }, '*') : null,
              )
            : null,
          header,
        )
      : null,
    wrapControl ? wrapControl(control) : control,
    hint ? el('span', { class: 'cv-hint', id: hintId }, hint) : null,
    errorNode,
  );
  /** @param {string | null | undefined} message */
  function setError(message) {
    errorText.textContent = message || '';
    errorNode.hidden = !message;
    if (message) {
      errorNode.setAttribute('role', 'alert');
      control.setAttribute('aria-invalid', 'true');
    } else {
      errorNode.removeAttribute('role');
      control.removeAttribute('aria-invalid');
    }
  }
  return Object.assign(wrapper, { input: control, setError });
}

/* ------------------ TextInput (+ DateTimeInput) ------------------ */
/**
 * @param {InputOptions} [opts]
 * @returns {import('./types.js').Field}
 */
function Input(opts = {}) {
  const {
    label,
    ariaLabel,
    value,
    placeholder,
    type = 'text',
    error,
    hint,
    icon: iconName,
    className,
    autoFocus,
    oninput,
    onkeydown,
    onblur,
    name,
    mono,
    required,
  } = opts;
  const id = fieldId('tn-input');
  const input = el('input', {
    type,
    value: value ?? '',
    placeholder,
    name,
    autocomplete: 'off',
    autofocus: autoFocus,
    required,
    oninput,
    onkeydown,
    onblur,
    class: `cv-input${mono ? ' cv-input--mono' : ''}`,
  });
  const f = field({
    label,
    ariaLabel,
    required,
    control: input,
    controlId: id,
    hint,
    className,
    wrapControl: iconName
      ? (control) => el('span', { class: 'cv-input-group' }, icon(iconName), control)
      : undefined,
  });
  if (error) f.setError(error);
  return f;
}

/* ------------------ Select ------------------ */
/**
 * @param {SelectOptions} opts
 * @returns {import('./types.js').Field<HTMLSelectElement>}
 */
function Select(opts) {
  const { label, ariaLabel, value, options, hint, onchange, className, name, mutates } = opts;
  const select = el(
    'select',
    {
      name,
      class: 'cv-input',
      'data-mutates': mutates ? '' : null,
      onchange: onchange
        ? (/** @type {Event} */ e) => onchange(/** @type {HTMLSelectElement} */ (e.target).value)
        : null,
    },
    options.map((o) => el('option', { value: o.value, selected: o.value === value }, o.label)),
  );
  return field({
    label,
    ariaLabel,
    control: select,
    controlId: fieldId('tn-select'),
    hint,
    className,
    wrapControl: (control) => el('span', { class: 'cv-select' }, control),
  });
}

/* ------------------ Checkbox and Switch ------------------ */
/**
 * @param {import('./types.js').CheckboxOptions} opts
 * @returns {HTMLLabelElement & { input: HTMLInputElement }}
 */
function Checkbox(opts) {
  const { label, ariaLabel, checked, onchange, mutates, switchRole, className } = opts;
  const input = el('input', {
    type: 'checkbox',
    role: switchRole ? 'switch' : null,
    checked: !!checked,
    'aria-label': ariaLabel,
    'data-mutates': mutates ? '' : null,
    onchange: onchange ? (/** @type {Event} */ e) => onchange(input.checked, e) : null,
  });
  const wrapper = el(
    'label',
    { class: `cv-check${switchRole ? ' cv-switch' : ''}${className ? ' ' + className : ''}` },
    input,
    label ? ` ${label}` : null,
  );
  return Object.assign(wrapper, { input });
}

/* ------------------ SegmentedControl ------------------ */
/**
 * @param {import('./types.js').SegmentedOptions} opts
 * @returns {HTMLFieldSetElement}
 */
function Segmented(opts) {
  const { legend, name, options, value, onchange } = opts;
  return el(
    'fieldset',
    { class: 'cv-segmented' },
    el('legend', null, legend),
    options.map((o) =>
      el(
        'label',
        null,
        el('input', {
          type: 'radio',
          name,
          value: o.value,
          checked: o.value === value,
          onchange: () => onchange(o.value),
        }),
        el('span', null, o.label),
      ),
    ),
  );
}

/* ------------------ Badge and Tag ------------------ */
/** @param {BadgeOptions} [opts] */
function Badge(opts = {}) {
  const { variant = 'neutral', children } = opts;
  const modifier = variant === 'neutral' ? '' : ` cv-badge--${variant}`;
  return el(
    'span',
    { class: `cv-badge${modifier}` },
    el('span', { class: 'cv-badge__dot' }),
    children,
  );
}

/**
 * A square tag for metadata and counts.
 * @param {Child} children
 * @param {{ mono?: boolean }} [opts]
 */
function Tag(children, { mono = false } = {}) {
  return el('span', { class: `cv-tag${mono ? ' cv-tag--mono' : ''}` }, children);
}

/* ------------------ Kbd ------------------ */
/** @param {string} text */
function Kbd(text) {
  return el('kbd', { class: 'cv-kbd' }, text);
}

/* ------------------ EmptyState ------------------ */
/**
 * @param {{ icon: string, title: string, text?: Child, actions?: Child }} opts
 */
function EmptyState({ icon: iconName, title, text, actions }) {
  return el(
    'div',
    { class: 'cv-empty' },
    el('span', { class: 'cv-empty__icon' }, icon(iconName)),
    el('p', { class: 'cv-empty__title' }, title),
    text ? el('p', null, text) : null,
    actions,
  );
}

/* ------------------ Alert ------------------ */
/**
 * @param {{ status: 'success' | 'warning' | 'danger' | 'info', title: string, text?: Child,
 *   live?: boolean }} opts
 */
function Alert({ status, title, text, live = false }) {
  /** @type {Record<string, string>} */
  const icons = { success: 'check-circle', warning: 'warning', danger: 'x-circle', info: 'info' };
  const role = live ? (status === 'danger' ? 'alert' : 'status') : null;
  return el(
    'div',
    { class: `cv-alert${status === 'info' ? '' : ' cv-alert--' + status}`, role },
    icon(icons[status] ?? 'info'),
    el(
      'div',
      { class: 'cv-alert__body' },
      el('span', { class: 'cv-alert__title' }, title),
      text ? ' ' : null,
      text,
    ),
  );
}

/* ------------------ Modal ------------------ */
/* A native <dialog> with the Modal anatomy, opened with Covenant.openDialog (showModal):
   Escape closes it, the page behind is inert, focus moves inside and returns to the opener.
   The dialog is removed from the document when it closes. */
/**
 * @param {ModalOptions} opts
 * @returns {ModalHandle}
 */
function Modal(opts) {
  const { title, body, footer, onclose } = opts;
  const titleId = fieldId('tn-modal-title');
  const titleNode = el('h2', { class: 'cv-modal__title', id: titleId }, title);
  const bodyNode = el('div', { class: 'cv-modal__body' }, body);
  /** @type {HTMLElement | null} */
  let footerNode = footer ? el('footer', { class: 'cv-modal__footer' }, footer) : null;
  const dialog = el(
    'dialog',
    { class: 'cv-modal', 'aria-labelledby': titleId },
    el(
      'header',
      { class: 'cv-modal__header' },
      titleNode,
      el(
        'button',
        {
          type: 'button',
          class: 'cv-btn cv-btn--ghost cv-btn--icon',
          'aria-label': t('common.close'),
          'data-cv-close': '',
        },
        icon('x'),
      ),
    ),
    bodyNode,
    footerNode,
  );

  function close() {
    window.Covenant?.closeDialog?.(dialog);
  }

  /**
   * Replaces the title, the body and the footer in place (a confirmation step inside the same
   * modal: modals are never stacked). Returns a function that puts the previous content back.
   * @param {{ title: string, body: Child, footer?: Child }} content
   */
  function replaceContent(content) {
    const previous = {
      title: titleNode.textContent ?? '',
      body: [...bodyNode.childNodes],
      footer: footerNode ? [...footerNode.childNodes] : null,
    };
    titleNode.textContent = content.title;
    bodyNode.replaceChildren();
    appendChildren(bodyNode, [content.body]);
    if (!footerNode) {
      footerNode = el('footer', { class: 'cv-modal__footer' });
      dialog.appendChild(footerNode);
    }
    footerNode.replaceChildren();
    appendChildren(footerNode, [content.footer]);
    return () => {
      titleNode.textContent = previous.title;
      bodyNode.replaceChildren(...previous.body);
      if (footerNode) {
        if (previous.footer) footerNode.replaceChildren(...previous.footer);
        else {
          footerNode.remove();
          footerNode = null;
        }
      }
    };
  }

  const opener = document.activeElement;
  document.body.appendChild(dialog);
  initCovenant(dialog);
  // After Covenant's own listener (it puts the focus back on the opener while the opener is
  // still in the document): the views that redraw every second replace their buttons, so the
  // opener is then found again by its focus key.
  dialog.addEventListener('close', () => {
    if (opener instanceof HTMLElement && !opener.isConnected && opener.dataset.focusKey) {
      /** @type {HTMLElement | null} */ (
        document.querySelector(`[data-focus-key="${CSS.escape(opener.dataset.focusKey)}"]`)
      )?.focus({ preventScroll: true });
    }
    dialog.remove();
    if (onclose) onclose();
  });
  window.Covenant?.openDialog?.(dialog);
  return { root: dialog, close, replaceContent };
}

/* ------------------ Confirmation ------------------ */
/**
 * A confirmation in a Modal, in place of the browser's `confirm()`. Resolves true when the
 * action is confirmed and false when it is cancelled or the dialog is closed (Escape).
 * With `within`, the question replaces the content of that modal and the previous content comes
 * back on the answer; otherwise it opens its own modal.
 * @param {ConfirmOptions} opts
 * @returns {Promise<boolean>}
 */
function Confirm(opts) {
  const { title, message, confirmLabel = t('common.confirm'), danger = false, within } = opts;
  return new Promise((resolve) => {
    let settled = false;
    /** @type {(() => void) | null} */
    let restore = null;
    /** @type {ModalHandle | null} */
    let own = null;
    /** @param {boolean} value */
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (restore) restore();
      else if (own) own.close();
      resolve(value);
    };
    const cancel = Button({
      children: t('common.cancel'),
      autoFocus: true,
      onclick: () => finish(false),
    });
    const confirmButton = Button({
      variant: danger ? 'danger' : 'primary',
      children: confirmLabel,
      onclick: () => finish(true),
    });
    const content = {
      title,
      body: el('p', { class: 'tn-message' }, message),
      footer: [cancel, confirmButton],
    };
    if (within) {
      restore = within.replaceContent(content);
      cancel.focus();
      within.root.addEventListener('close', () => finish(false), { once: true });
    } else {
      own = Modal({ ...content, onclose: () => finish(false) });
    }
  });
}

/* ------------------ Toast ------------------ */
/* Covenant.toast: success and info leave after 6 s (paused on hover and focus), warnings and
   errors stay until they are dismissed. */
function ToastHost() {
  /**
   * Covenant's own labels are English. It creates the region of the toasts when the first one
   * appears, and uses the one already in the page: the Toast page of the skill shows that
   * markup, so the region is created here with its name in the language of the interface.
   */
  function ensureRegion() {
    if (document.querySelector('.cv-toast-region')) return;
    document.body.append(
      el('section', { class: 'cv-toast-region', 'aria-label': t('shell.notifications') }),
    );
  }

  /** @param {ToastOptions} toast */
  function push({ variant = 'info', title, body, timeout, action }) {
    ensureRegion();
    const toast = window.Covenant?.toast?.({
      status: variant,
      title,
      text: body ?? undefined,
      timeout,
    });
    if (toast && action) {
      const button = el('button', {
        type: 'button',
        class: 'cv-btn cv-btn--primary cv-btn--sm',
        onclick: () => action.onclick(button),
      });
      button.textContent = action.label;
      toast.querySelector('.cv-toast__body')?.append(button);
    }
    // The dismiss button of each toast is built by Covenant with an English name.
    toast
      ?.querySelector('[data-cv-dismiss]')
      ?.setAttribute('aria-label', t('shell.dismissNotification'));
    return toast ?? undefined;
  }
  return { push };
}

export {
  Alert,
  Badge,
  Button,
  Checkbox,
  Confirm,
  EmptyState,
  IconButton,
  Input,
  Kbd,
  Menu,
  Modal,
  Segmented,
  Select,
  Tag,
  ToastHost,
};
