import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { UI_KEYS, createUi } from '../src/ui.js';
import { fake, installFakeDom } from './support/fake-dom.js';

/** A translator that shows its key, so a test sees which message a builder asked for. */
const i18n = {
  locale: 'fr',
  t: (/** @type {string} */ key) => `[${key}]`,
};

const covenant = {
  init: vi.fn(),
  openDialog: vi.fn(),
  closeDialog: vi.fn((dialog) => dialog.close()),
  toast: vi.fn(),
};
const ui = createUi({ prefix: 'zz', i18n });

/** @type {ReturnType<typeof installFakeDom>} */
let dom;
beforeEach(() => {
  vi.clearAllMocks();
  dom = installFakeDom(covenant);
});
afterEach(() => dom.restore());

describe('UI_KEYS', () => {
  test('lists the messages the builders ask for', () => {
    expect(UI_KEYS).toEqual([
      'common.close',
      'common.cancel',
      'common.confirm',
      'shell.notifications',
      'shell.dismissNotification',
    ]);
  });
});

describe('Button', () => {
  test('is a Covenant button with a variant, a size and an icon', () => {
    const button = fake(
      ui.Button({ variant: 'danger', size: 'sm', icon: 'trash', children: 'Delete' }),
    );
    expect(button.className).toBe('cv-btn cv-btn--danger cv-btn--sm');
    expect(button.type).toBe('button');
    expect(button.children[0]?.className).toBe('ph ph-trash cv-icon');
    expect(button.textContent).toBe('Delete');
  });

  test('marks a button that changes data, and ignores the click when disabled', () => {
    const onclick = vi.fn();
    expect(fake(ui.Button({ mutates: true })).hasAttribute('data-mutates')).toBe(true);
    fake(ui.Button({ disabled: true, onclick })).click();
    expect(onclick).not.toHaveBeenCalled();
  });
});

describe('IconButton', () => {
  test('names the button and its tooltip with the same label, and wires the wrapper', () => {
    const wrap = ui.IconButton({ icon: 'gear', label: 'Settings' });
    expect(fake(wrap).className).toBe('cv-tooltip-wrap');
    expect(fake(wrap.button).getAttribute('aria-label')).toBe('Settings');
    expect(fake(wrap.button).className).toBe('cv-btn cv-btn--icon cv-btn--ghost');
    const tip = fake(wrap).children[1];
    expect(tip?.getAttribute('role')).toBe('tooltip');
    expect(tip?.textContent).toBe('Settings');
    // Covenant wires what is below the node it is given: the wrapper sits in a fragment.
    expect(covenant.init).toHaveBeenCalledOnce();
    expect(covenant.init.mock.calls[0]?.[0].nodeType).toBe(11);
  });
});

describe('Menu', () => {
  const items = [
    { label: 'Rename', icon: 'pencil', onclick: vi.fn() },
    { separator: /** @type {const} */ (true) },
    { label: 'Delete', icon: 'trash', onclick: vi.fn(), danger: true },
  ];

  test('links an icon button to its popover', () => {
    const host = ui.Menu({ label: 'Actions', icon: 'dots-three', items });
    expect(fake(host).className).toBe('zz-menu-host');
    const menuId = fake(host.menu).id;
    expect(menuId).toMatch(/^zz-menu-\d+$/);
    expect(host.button.getAttribute('popovertarget')).toBe(menuId);
    expect(host.button.getAttribute('aria-haspopup')).toBe('menu');
    expect(host.button.getAttribute('aria-expanded')).toBe('false');
    expect(fake(host.menu).getAttribute('role')).toBe('menu');
    expect(fake(host.menu).getAttribute('aria-label')).toBe('Actions');
    expect(fake(host.menu).children.map((child) => child.className)).toEqual([
      'cv-menu__item',
      'cv-menu__sep',
      'cv-menu__item cv-menu__item--danger',
    ]);
  });

  test('with a visible text, the aria-label repeats it', () => {
    const host = ui.Menu({ label: 'Actions', icon: 'dots-three', text: 'More', items });
    expect(host.button.getAttribute('aria-label')).toBe('Actions');
    expect(fake(host).children[0]).toBe(fake(host.button));
    expect(fake(host.button).querySelector('.zz-btn-label')?.textContent).toBe('More');
  });
});

describe('fields', () => {
  test('Input links its label, hint and error, and shows an error on demand', () => {
    const field = ui.Input({ label: 'Name', hint: 'Short', required: true, icon: 'user' });
    const input = fake(field.input);
    const label = fake(field).querySelector('label');
    expect(label?.getAttribute('for')).toBe(input.id);
    expect(input.getAttribute('aria-describedby')?.split(' ')).toHaveLength(2);
    expect(fake(field).querySelector('.cv-hint')?.textContent).toBe('Short');
    expect(fake(field).querySelector('.cv-input-group')).not.toBeNull();
    expect(input.className).toBe('cv-input');

    const error = fake(field).querySelector('.cv-error');
    expect(error?.hidden).toBe(true);
    field.setError('Required');
    expect(error?.hidden).toBe(false);
    expect(error?.getAttribute('role')).toBe('alert');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    field.setError(null);
    expect(error?.hidden).toBe(true);
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });

  test('a field without a visible label takes its name from aria-label', () => {
    const field = ui.Input({ ariaLabel: 'Search' });
    expect(fake(field.input).getAttribute('aria-label')).toBe('Search');
    expect(fake(field).querySelector('label')).toBeNull();
  });

  test('Textarea counts its characters, with the app layout class', () => {
    const field = ui.Textarea({ label: 'Notes', value: 'abc', maxLength: 10 });
    const counter = fake(field).querySelector('.cv-caption');
    expect(counter?.textContent).toBe('3 / 10');
    expect(counter?.className).toBe('cv-caption cv-num zz-end');
    expect(fake(field).children[0]?.className).toBe('zz-row zz-gap-3 zz-baseline');
  });

  test('Select marks the current value', () => {
    const field = ui.Select({
      label: 'Sort',
      value: 'b',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    });
    const options = fake(field.input).children;
    expect(options.map((option) => option.selected)).toEqual([false, true]);
    expect(fake(field).querySelector('.cv-select')).not.toBeNull();
  });

  test('Combobox lists the unique suggestions in the locale and an empty message', () => {
    const field = ui.Combobox({
      label: 'Client',
      options: ['Béta', 'alpha', ' alpha ', ''],
      emptyText: 'Nothing',
    });
    const list = fake(field).querySelector('.cv-listbox');
    const values = list?.children.map((item) => item.getAttribute('data-value'));
    expect(values).toEqual(['alpha', 'Béta', null]);
    expect(list?.querySelector('.cv-listbox__empty')?.textContent).toBe('Nothing');
    expect(fake(field.input).getAttribute('role')).toBe('combobox');
    expect(fake(field.input).getAttribute('aria-controls')).toBe(list?.id);
    expect(covenant.init).toHaveBeenCalledWith(field);
  });
});

describe('Checkbox, Segmented, Badge, Tag, Kbd', () => {
  test('Checkbox draws a switch when asked', () => {
    const plain = fake(ui.Checkbox({ label: 'Remember' }));
    expect(plain.className).toBe('cv-check');
    expect(plain.textContent).toBe(' Remember');
    const toggle = ui.Checkbox({ ariaLabel: 'Dark', switchRole: true, checked: true });
    expect(fake(toggle).className).toBe('cv-check cv-switch');
    expect(fake(toggle.input).getAttribute('role')).toBe('switch');
    expect(fake(toggle.input).checked).toBe(true);
  });

  test('Segmented is a fieldset of radios with a legend', () => {
    const onchange = vi.fn();
    const control = fake(
      ui.Segmented({
        legend: 'View',
        name: 'view',
        value: 'a',
        onchange,
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      }),
    );
    expect(control.className).toBe('cv-segmented');
    expect(control.querySelector('legend')?.textContent).toBe('View');
    const radios = control.querySelectorAll('input');
    expect(radios.map((radio) => radio.checked)).toEqual([true, false]);
    radios[1]?.click('change');
    expect(onchange).toHaveBeenCalledWith('b');
  });

  test('Badge, Tag and Kbd', () => {
    expect(fake(ui.Badge({ variant: 'success', children: 'Done' })).className).toBe(
      'cv-badge cv-badge--success',
    );
    expect(fake(ui.Badge()).className).toBe('cv-badge');
    expect(fake(ui.Tag('v1', { mono: true })).className).toBe('cv-tag cv-tag--mono');
    expect(fake(ui.Kbd('K')).className).toBe('cv-kbd');
  });
});

describe('EmptyState and Alert', () => {
  test('EmptyState carries its icon, title, text and actions', () => {
    const empty = fake(ui.EmptyState({ icon: 'tray', title: 'No notes', text: 'Write one.' }));
    expect(empty.className).toBe('cv-empty');
    expect(empty.querySelector('.cv-empty__title')?.textContent).toBe('No notes');
    expect(empty.textContent).toContain('Write one.');
  });

  test('Alert always has an icon and a bold lead, and a live role only when asked', () => {
    const quiet = fake(ui.Alert({ status: 'danger', title: 'Failed', text: 'Retry.' }));
    expect(quiet.className).toBe('cv-alert cv-alert--danger');
    expect(quiet.hasAttribute('role')).toBe(false);
    expect(quiet.querySelector('.ph-x-circle')).not.toBeNull();
    expect(
      fake(ui.Alert({ status: 'danger', title: 'Failed', live: true })).getAttribute('role'),
    ).toBe('alert');
    expect(fake(ui.Alert({ status: 'info', title: 'FYI', live: true })).getAttribute('role')).toBe(
      'status',
    );
    expect(fake(ui.Alert({ status: 'info', title: 'FYI' })).className).toBe('cv-alert');
  });
});

describe('Modal', () => {
  test('is a labelled dialog in the document, opened through Covenant, with a translated close button', () => {
    const onclose = vi.fn();
    const modal = ui.Modal({ title: 'Rename', body: 'Body', footer: 'Footer', onclose });
    const dialog = fake(modal.root);
    expect(dialog.parentNode).toBe(fake(document.body));
    expect(dialog.getAttribute('aria-labelledby')).toBe(dialog.querySelector('h2')?.id);
    expect(dialog.querySelector('.cv-btn--icon')?.getAttribute('aria-label')).toBe(
      '[common.close]',
    );
    expect(covenant.init).toHaveBeenCalledWith(modal.root);
    expect(covenant.openDialog).toHaveBeenCalledWith(modal.root);
    modal.close();
    expect(covenant.closeDialog).toHaveBeenCalledWith(modal.root);
    expect(dialog.parentNode).toBeNull();
    expect(onclose).toHaveBeenCalledOnce();
  });

  test('gives the focus back to the opener by its focus key when a redraw replaced it', () => {
    const opener = fake(document.createElement('button'));
    opener.dataset.focusKey = 'open';
    fake(document.body).append(opener);
    opener.focus();
    const modal = ui.Modal({ title: 'Edit', body: 'Form' });
    // The view drew its buttons again while the modal was open.
    opener.remove();
    const replacement = fake(document.createElement('button'));
    replacement.setAttribute('data-focus-key', 'open');
    fake(document.body).append(replacement);
    fake(modal.root).close();
    expect(document.activeElement).toBe(replacement);
  });

  test('replaceContent swaps the content and puts the previous one back', () => {
    const modal = ui.Modal({ title: 'Rename', body: 'Body', footer: 'Footer' });
    const dialog = fake(modal.root);
    const restore = modal.replaceContent({ title: 'Sure?', body: 'Really', footer: 'Yes' });
    expect(dialog.querySelector('h2')?.textContent).toBe('Sure?');
    expect(dialog.querySelector('.cv-modal__body')?.textContent).toBe('Really');
    restore();
    expect(dialog.querySelector('h2')?.textContent).toBe('Rename');
    expect(dialog.querySelector('.cv-modal__body')?.textContent).toBe('Body');
    expect(dialog.querySelector('.cv-modal__footer')?.textContent).toBe('Footer');
  });
});

describe('Confirm', () => {
  test('resolves true on confirm, with the translated default labels', async () => {
    const answer = ui.Confirm({ title: 'Delete', message: 'Sure?', danger: true });
    const footer = fake(document.body).querySelector('.cv-modal__footer');
    expect(footer?.children.map((button) => button.textContent)).toEqual([
      '[common.cancel]',
      '[common.confirm]',
    ]);
    expect(footer?.children[1]?.className).toBe('cv-btn cv-btn--danger');
    footer?.children[1]?.click();
    await expect(answer).resolves.toBe(true);
    expect(covenant.closeDialog).toHaveBeenCalled();
  });

  test('resolves false on cancel, and when the dialog is closed', async () => {
    const cancelled = ui.Confirm({ title: 'Delete', message: 'Sure?', confirmLabel: 'Delete' });
    fake(document.body).querySelector('.cv-modal__footer')?.children[0]?.click();
    await expect(cancelled).resolves.toBe(false);

    const dismissed = ui.Confirm({ title: 'Delete', message: 'Sure?' });
    fake(document.body).querySelector('dialog')?.close();
    await expect(dismissed).resolves.toBe(false);
  });

  test('asks inside another modal and restores its content', async () => {
    const modal = ui.Modal({ title: 'Edit', body: 'Form', footer: 'Save' });
    const answer = ui.Confirm({ title: 'Discard', message: 'Sure?', within: modal });
    const dialog = fake(modal.root);
    expect(dialog.querySelector('h2')?.textContent).toBe('Discard');
    dialog.querySelector('.cv-modal__footer')?.children[1]?.click();
    await expect(answer).resolves.toBe(true);
    expect(dialog.querySelector('h2')?.textContent).toBe('Edit');
  });
});

describe('ToastHost', () => {
  test('creates the region in the language of the app and names the dismiss button', () => {
    const toast = fake(document.createElement('div'));
    const body = fake(document.createElement('div'));
    body.className = 'cv-toast__body';
    const dismiss = fake(document.createElement('button'));
    dismiss.setAttribute('data-cv-dismiss', '');
    toast.append(body, dismiss);
    covenant.toast.mockReturnValue(toast);

    const action = vi.fn();
    const host = ui.ToastHost();
    const shown = host.push({
      variant: 'success',
      title: 'Saved',
      body: 'All good',
      action: { label: 'Undo', onclick: action },
    });

    const region = fake(document.body).querySelector('.cv-toast-region');
    expect(region?.getAttribute('aria-label')).toBe('[shell.notifications]');
    expect(covenant.toast).toHaveBeenCalledWith({
      status: 'success',
      title: 'Saved',
      text: 'All good',
      timeout: undefined,
    });
    expect(dismiss.getAttribute('aria-label')).toBe('[shell.dismissNotification]');
    const button = body.querySelector('button');
    expect(button?.textContent).toBe('Undo');
    button?.click();
    expect(action).toHaveBeenCalledWith(button);
    expect(shown).toBe(toast);

    host.push({ title: 'Again' });
    expect(fake(document.body).querySelectorAll('.cv-toast-region')).toHaveLength(1);
  });

  test('returns nothing without Covenant', () => {
    dom.restore();
    dom = installFakeDom({});
    expect(ui.ToastHost().push({ title: 'Hi' })).toBeUndefined();
  });
});
