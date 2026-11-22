// The dialogs of an application: create one, add or change an extra link, set the address of a
// link for one environment (an override), and delete the application. Each one is a Covenant
// modal; the change itself is a command of the store.
import { slugify } from '../../core/model.js';
import { slugTaken } from '../../core/selectors.js';
import { parseUrl } from '../../core/url.js';
import { addAppCommand, addExtraCommand } from '../commands.js';
import * as UI from './ui.js';

const { el, t } = UI;

/** @param {import('../../types.d.ts').Settings} settings */
function tagOptions(settings) {
  return [
    { value: '', label: t('tags.none') },
    ...settings.tags.map((tag) => ({ value: tag.key, label: tag.label })),
  ];
}

/**
 * Creates an application: name, slug (made from the name until it is edited), template and Jira
 * key. `onCreated` gets its id.
 * @param {import('./types.js').Store} store
 * @param {(id: string) => void} onCreated
 * @returns {import('./types.js').ModalHandle | null} `null` when there is no template to choose
 */
export function openNewApp(store, onCreated) {
  const { templates } = store.getState();
  if (templates.length === 0) {
    const info = UI.Modal({
      title: t('apps.noTemplateTitle'),
      body: el('p', null, t('apps.noTemplateMessage')),
      footer: UI.Button({ children: t('common.close'), onclick: () => info.close() }),
    });
    return null;
  }
  let slugTouched = false;
  const nameField = UI.Input({
    label: t('apps.nameLabel'),
    placeholder: t('apps.namePlaceholder'),
    autoFocus: true,
    required: true,
  });
  const slugField = UI.Input({
    label: t('apps.slugLabel'),
    hint: t('apps.slugHint'),
    icon: 'hash',
    mono: true,
  });
  const templateField = UI.Select({
    label: t('apps.templateLabel'),
    value: templates[0]?.id ?? '',
    options: templates.map((template) => ({
      value: template.id,
      label: t('apps.templateOption', {
        name: template.name,
        envs: template.envs.length,
        links: template.links.length,
      }),
    })),
  });
  const jiraField = UI.Input({
    label: t('apps.jiraLabel'),
    placeholder: t('apps.jiraPlaceholder'),
  });

  nameField.input.addEventListener('input', () => {
    nameField.setError(null);
    if (!slugTouched) slugField.input.value = slugify(nameField.input.value);
  });
  slugField.input.addEventListener('input', () => {
    slugTouched = true;
    slugField.setError(null);
  });

  function submit() {
    const name = nameField.input.value.trim();
    const slug = slugify(slugField.input.value);
    const template = templates.find((candidate) => candidate.id === templateField.input.value);
    if (name === '') {
      nameField.setError(t('apps.nameEmpty'));
      nameField.input.focus();
      return;
    }
    if (slug === '') {
      slugField.setError(t('apps.slugEmpty'));
      slugField.input.focus();
      return;
    }
    if (slugTaken(store.getState(), slug, null)) {
      slugField.setError(t('apps.slugTaken', { slug }));
      slugField.input.focus();
      return;
    }
    if (!template) return;
    const command = addAppCommand(template, { name, slug, jiraKey: jiraField.input.value.trim() });
    store.dispatch(command);
    modal.close();
    onCreated(command.app.id);
  }
  for (const field of [nameField, slugField, jiraField]) {
    field.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });
  }
  const modal = UI.Modal({
    title: t('apps.newTitle'),
    body: el(
      'div',
      { class: 'dsh-stack dsh-gap-5' },
      nameField,
      slugField,
      templateField,
      jiraField,
    ),
    footer: [
      UI.Button({ children: t('common.cancel'), onclick: () => modal.close() }),
      UI.Button({
        variant: 'primary',
        icon: 'plus',
        children: t('common.create'),
        onclick: submit,
      }),
    ],
  });
  return modal;
}

/**
 * Adds an extra link to an application, or changes one.
 * @param {import('./types.js').Store} store
 * @param {import('../../types.d.ts').App} app
 * @param {import('../../types.d.ts').Extra | null} extra the link to change; `null` to add one
 * @returns {import('./types.js').ModalHandle}
 */
export function openExtraForm(store, app, extra) {
  const { settings } = store.getState();
  const nameField = UI.Input({
    label: t('extras.nameLabel'),
    value: extra?.name ?? '',
    placeholder: t('extras.namePlaceholder'),
    autoFocus: true,
    required: true,
  });
  const urlField = UI.Input({
    label: t('extras.urlLabel'),
    value: extra?.url ?? '',
    placeholder: t('urls.placeholder'),
    icon: 'link',
    required: true,
  });
  const tagField = UI.Select({
    label: t('extras.tagLabel'),
    value: extra?.tag ?? settings.tags[0]?.key ?? '',
    options: tagOptions(settings),
  });
  nameField.input.addEventListener('input', () => nameField.setError(null));
  urlField.input.addEventListener('input', () => urlField.setError(null));

  function submit() {
    const name = nameField.input.value.trim();
    const parsed = parseUrl(urlField.input.value);
    if (!parsed.ok) {
      urlField.setError(
        parsed.reason === 'unsupported'
          ? t('urls.unsupported')
          : parsed.reason === 'empty'
            ? t('urls.empty')
            : t('urls.invalid'),
      );
      urlField.input.focus();
      return;
    }
    const tag = tagField.input.value;
    modal.close();
    if (extra) {
      store.dispatch({
        type: 'update_extra',
        appId: app.id,
        id: extra.id,
        name,
        url: parsed.url,
        tag,
      });
    } else {
      store.dispatch(addExtraCommand(app.id, { name, url: parsed.url, tag }));
    }
  }
  for (const field of [nameField, urlField]) {
    field.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });
  }
  const modal = UI.Modal({
    title: extra ? t('extras.editTitle') : t('extras.newTitle'),
    body: el('div', { class: 'dsh-stack dsh-gap-5' }, nameField, urlField, tagField),
    footer: [
      UI.Button({ children: t('common.cancel'), onclick: () => modal.close() }),
      UI.Button({
        variant: 'primary',
        children: extra ? t('common.save') : t('common.add'),
        onclick: submit,
      }),
    ],
  });
  return modal;
}

/**
 * Sets the address of a link for one environment of an application, in place of its pattern.
 * @param {import('./types.js').Store} store
 * @param {{ app: import('../../types.d.ts').App, envKey: string,
 *   resolved: import('../../types.d.ts').ResolvedLink }} target
 * @returns {import('./types.js').ModalHandle}
 */
export function openOverrideForm(store, { app, envKey, resolved }) {
  const urlField = UI.Input({
    label: t('overrides.urlLabel'),
    hint: t('overrides.urlHint', { pattern: resolved.link.pattern }),
    value: resolved.overridden ? resolved.url : '',
    placeholder: t('urls.placeholder'),
    icon: 'link',
    autoFocus: true,
  });
  urlField.input.addEventListener('input', () => urlField.setError(null));

  function submit() {
    const text = urlField.input.value.trim();
    if (text !== '') {
      const parsed = parseUrl(text);
      if (!parsed.ok) {
        urlField.setError(
          parsed.reason === 'unsupported' ? t('urls.unsupported') : t('urls.invalid'),
        );
        urlField.input.focus();
        return;
      }
    }
    store.dispatch({
      type: 'set_override',
      appId: app.id,
      envKey,
      linkId: resolved.link.id,
      url: text,
    });
    modal.close();
  }
  urlField.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });
  const modal = UI.Modal({
    title: t('overrides.title', { name: resolved.link.name }),
    body: el('div', { class: 'dsh-stack dsh-gap-5' }, urlField),
    footer: [
      UI.Button({ children: t('common.cancel'), onclick: () => modal.close() }),
      UI.Button({ variant: 'primary', children: t('common.save'), onclick: submit }),
    ],
  });
  return modal;
}

/**
 * Asks, then deletes the application.
 * @param {import('./types.js').Store} store
 * @param {import('./types.js').ToastHost} toasts
 * @param {import('../../types.d.ts').App} app
 * @returns {Promise<boolean>} whether it was deleted
 */
export async function confirmDeleteApp(store, toasts, app) {
  const ok = await UI.Confirm({
    title: t('apps.deleteTitle'),
    message: t('apps.deleteMessage', { name: app.name }),
    confirmLabel: t('common.delete'),
    danger: true,
  });
  if (!ok) return false;
  store.dispatch({ type: 'delete_app', id: app.id });
  toasts.push({ variant: 'info', title: t('apps.deleted'), body: app.name });
  return true;
}
