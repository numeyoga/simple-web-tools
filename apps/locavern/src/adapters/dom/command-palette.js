/**
 * Dynamic Command Menu controller for #cmd-menu (Covenant CommandMenu anatomy).
 * Preserves static commands from #cmd-list and appends live local items
 * (projects, tasks, notes, whiteboards) with keyboard navigation and IME-safe Enter.
 */

import { matchesSearchTokens, tokenizeSearchQuery } from '../../core/search.js';
import { closeDialogById } from './app-shell.js';

/**
 * @typedef {{
 *   value: string;
 *   label: string;
 *   meta?: string;
 *   icon: string;
 *   searchText?: string;
 * }} CommandPaletteItem
 */

const MAX_VISIBLE_RESULTS = 60;

/**
 * Wire the dynamic command palette inside #cmd-menu.
 * Dispatches `cv:command` with `{ value }` just like Covenant's built-in combobox.
 * @param {{
 *   getDynamicItems?: () => CommandPaletteItem[];
 * }} opts
 */
export function wireCommandPalette({ getDynamicItems }) {
  const dialog = /** @type {HTMLDialogElement | null} */ (document.getElementById('cmd-menu'));
  const combobox = dialog?.querySelector('.cv-combobox');
  const input = /** @type {HTMLInputElement | null} */ (
    combobox?.querySelector('.cv-cmd__input') ?? null
  );
  const list = /** @type {HTMLUListElement | null} */ (document.getElementById('cmd-list') ?? null);
  if (!dialog || !combobox || !input || !list) return;

  /** @type {CommandPaletteItem[]} */
  const staticItems = [...list.querySelectorAll('[role="option"]')].map((el) => {
    const iconEl = el.querySelector('i');
    const iconClass =
      [...(iconEl?.classList ?? [])].find((c) => c.startsWith('ph-') && c !== 'ph') ??
      'ph-terminal';
    const label = el.textContent?.trim() ?? '';
    return {
      value: el.getAttribute('data-value') ?? label,
      label,
      icon: iconClass,
      searchText: label,
    };
  });

  const emptyEl =
    list.querySelector('.cv-listbox__empty') ??
    (() => {
      const li = document.createElement('li');
      li.className = 'cv-listbox__empty';
      li.textContent = 'Aucun résultat.';
      return li;
    })();

  /** @type {HTMLLIElement[]} */
  let renderedOptions = [];
  let activeIndex = -1;
  let optionUid = 0;

  /** @param {number} index */
  function setActive(index) {
    for (const opt of renderedOptions) {
      opt.removeAttribute('data-active');
    }
    if (renderedOptions.length === 0) {
      activeIndex = -1;
      input?.removeAttribute('aria-activedescendant');
      return;
    }
    activeIndex =
      ((index % renderedOptions.length) + renderedOptions.length) % renderedOptions.length;
    const target = renderedOptions[activeIndex];
    if (target) {
      target.setAttribute('data-active', '');
      input?.setAttribute('aria-activedescendant', target.id);
      target.scrollIntoView({ block: 'nearest' });
    }
  }

  function renderOptions() {
    if (!input || !list) return;
    const tokens = tokenizeSearchQuery(input.value);
    const dynamicItems = getDynamicItems ? getDynamicItems() : [];
    const allItems = [...staticItems, ...dynamicItems];

    const matched =
      tokens.length > 0
        ? allItems.filter((item) =>
            matchesSearchTokens(
              `${item.label} ${item.meta ?? ''} ${item.searchText ?? ''}`,
              tokens,
            ),
          )
        : allItems;

    const sliced = matched.slice(0, MAX_VISIBLE_RESULTS);
    /** @type {HTMLLIElement[]} */
    const nextNodes = [];

    for (const item of sliced) {
      optionUid += 1;
      const li = document.createElement('li');
      li.className = 'cv-option';
      li.id = `lc-cmd-opt-${optionUid}`;
      li.setAttribute('role', 'option');
      li.dataset.value = item.value;

      const ic = document.createElement('i');
      ic.className = `ph ${item.icon} cv-icon`;
      ic.setAttribute('aria-hidden', 'true');

      const labelSpan = document.createElement('span');
      labelSpan.className = 'lc-cmd-option__label';
      labelSpan.textContent = item.label;

      li.append(ic, labelSpan);
      if (item.meta) {
        const metaSpan = document.createElement('span');
        metaSpan.className = 'cv-caption lc-cmd-option__meta';
        metaSpan.textContent = item.meta;
        li.append(metaSpan);
      }
      nextNodes.push(li);
    }

    renderedOptions = nextNodes;
    if (emptyEl instanceof HTMLElement) {
      emptyEl.hidden = nextNodes.length > 0;
    }
    list.replaceChildren(...nextNodes, emptyEl);
    setActive(nextNodes.length > 0 ? 0 : -1);
  }

  /** @param {HTMLLIElement} option */
  function chooseOption(option) {
    const value = option.dataset.value || option.textContent?.trim() || '';
    closeDialogById('cmd-menu');
    if (value) {
      combobox?.dispatchEvent(new CustomEvent('cv:command', { bubbles: true, detail: { value } }));
    }
  }

  input.setAttribute('aria-autocomplete', 'list');

  input.addEventListener('input', () => {
    renderOptions();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(activeIndex - 1);
    } else if (event.key === 'Home') {
      if (renderedOptions.length > 0) {
        event.preventDefault();
        setActive(0);
      }
    } else if (event.key === 'End') {
      if (renderedOptions.length > 0) {
        event.preventDefault();
        setActive(renderedOptions.length - 1);
      }
    } else if (event.key === 'Enter') {
      const activeOption = activeIndex >= 0 ? renderedOptions[activeIndex] : undefined;
      if (activeOption) {
        event.preventDefault();
        if (event.isComposing || event.keyCode === 229) {
          return;
        }
        chooseOption(activeOption);
      }
    }
  });

  list.addEventListener('mousedown', (event) => {
    event.preventDefault();
  });

  list.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[role="option"]') : null;
    if (target instanceof HTMLLIElement) {
      chooseOption(target);
    }
  });

  dialog.addEventListener('close', () => {
    input.value = '';
    renderOptions();
  });

  const observer = new MutationObserver(() => {
    if (dialog.open) {
      input.value = '';
      renderOptions();
      input.focus();
    }
  });
  observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });

  document.addEventListener(
    'keydown',
    (event) => {
      if ((event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'K')) {
        input.value = '';
        renderOptions();
      }
    },
    { capture: true },
  );
  document.addEventListener(
    'click',
    (event) => {
      const opener =
        event.target instanceof Element ? event.target.closest('[data-cv-open="cmd-menu"]') : null;
      if (opener) {
        input.value = '';
        renderOptions();
      }
    },
    { capture: true },
  );

  renderOptions();
}
