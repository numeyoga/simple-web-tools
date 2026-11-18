/** @import { InputPresentationScreen, AppCommand, AppState, InputPresentation, StoreEffect } from '../../types.d.ts' */

import {
  INPUT_PRESENTATION_SCREENS,
  MAX_TOAST_DURATION_SECONDS,
  MAX_TRASH_RETENTION_DAYS,
  MIN_TOAST_DURATION_SECONDS,
  MIN_TRASH_RETENTION_DAYS,
} from '../../core/model.js';
import { closeDialogById, openDialogById } from './app-shell.js';

/**
 * Parse and validate an integer string within [min, max].
 * @param {string} raw
 * @param {number} min
 * @param {number} max
 * @returns {{ ok: true; value: number } | { ok: false }}
 */
function parseBoundedIntInput(raw, min, max) {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false };
  }
  const value = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    return { ok: false };
  }
  return { ok: true, value };
}

/**
 * Wire display preferences controls inside #modal-preferences
 * (per-screen input presentation, toast auto-dismiss duration, and trash retention delay).
 * @param {{
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *     subscribe: (
 *       listener: (info: {
 *         state: AppState;
 *         prevState: AppState;
 *         command: AppCommand;
 *         effects: StoreEffect[];
 *       }) => void,
 *     ) => () => void;
 *   };
 * }} opts
 */
export function wirePreferencesModal({ store }) {
  const modal = document.getElementById('modal-preferences');
  if (!modal) return;
  const modalEl = modal;

  const durationInput = /** @type {HTMLInputElement | null} */ (
    modalEl.querySelector('#pref-toast-duration')
  );
  const durationError = modalEl.querySelector('#pref-toast-duration-error');
  const retentionInput = /** @type {HTMLInputElement | null} */ (
    modalEl.querySelector('#pref-trash-retention')
  );
  const retentionError = modalEl.querySelector('#pref-trash-retention-error');
  const openStatusesBtn = modalEl.querySelector('#btn-pref-open-statuses');

  openStatusesBtn?.addEventListener('click', () => {
    closeDialogById('modal-preferences');
    openDialogById('modal-statuses');
  });

  function clearDurationError() {
    if (!durationInput) return;
    durationInput.removeAttribute('aria-invalid');
    durationInput.setAttribute('aria-describedby', 'pref-toast-duration-hint');
    if (durationError instanceof HTMLElement) {
      durationError.hidden = true;
      durationError.replaceChildren();
    }
  }

  function showDurationError() {
    if (!durationInput) return;
    durationInput.setAttribute('aria-invalid', 'true');
    durationInput.setAttribute(
      'aria-describedby',
      'pref-toast-duration-error pref-toast-duration-hint',
    );
    if (durationError instanceof HTMLElement) {
      const icon = document.createElement('i');
      icon.className = 'ph ph-warning-circle cv-icon';
      icon.setAttribute('aria-hidden', 'true');
      durationError.replaceChildren(
        icon,
        document.createTextNode(
          `Durée invalide : valeur hors plage ou non entière. Saisissez un entier entre ${MIN_TOAST_DURATION_SECONDS} et ${MAX_TOAST_DURATION_SECONDS} secondes.`,
        ),
      );
      durationError.hidden = false;
    }
  }

  function clearRetentionError() {
    if (!retentionInput) return;
    retentionInput.removeAttribute('aria-invalid');
    retentionInput.setAttribute('aria-describedby', 'pref-trash-retention-hint');
    if (retentionError instanceof HTMLElement) {
      retentionError.hidden = true;
      retentionError.replaceChildren();
    }
  }

  function showRetentionError() {
    if (!retentionInput) return;
    retentionInput.setAttribute('aria-invalid', 'true');
    retentionInput.setAttribute(
      'aria-describedby',
      'pref-trash-retention-error pref-trash-retention-hint',
    );
    if (retentionError instanceof HTMLElement) {
      const icon = document.createElement('i');
      icon.className = 'ph ph-warning-circle cv-icon';
      icon.setAttribute('aria-hidden', 'true');
      retentionError.replaceChildren(
        icon,
        document.createTextNode(
          `Délai invalide : saisissez un entier entre ${MIN_TRASH_RETENTION_DAYS} et ${MAX_TRASH_RETENTION_DAYS} jours.`,
        ),
      );
      retentionError.hidden = false;
    }
  }

  /**
   * Synchronize preference controls with current store state.
   * @param {{ forceDuration?: boolean; forceRetention?: boolean }} [opts]
   */
  function syncControls({ forceDuration = false, forceRetention = false } = {}) {
    const { inputPresentations, toastDurationSeconds, trashRetentionDays } =
      store.getState().preferences;
    for (const fieldset of modalEl.querySelectorAll('fieldset[data-input-screen]')) {
      const screenAttr = fieldset.getAttribute('data-input-screen');
      if (
        !screenAttr ||
        !INPUT_PRESENTATION_SCREENS.includes(/** @type {InputPresentationScreen} */ (screenAttr))
      ) {
        continue;
      }
      const screen = /** @type {InputPresentationScreen} */ (screenAttr);
      const activePresentation = inputPresentations[screen];
      for (const radio of fieldset.querySelectorAll('input[type="radio"]')) {
        if (radio instanceof HTMLInputElement) {
          radio.checked = radio.value === activePresentation;
        }
      }
    }

    if (durationInput && (forceDuration || document.activeElement !== durationInput)) {
      durationInput.value = String(toastDurationSeconds);
      clearDurationError();
    }

    if (retentionInput && (forceRetention || document.activeElement !== retentionInput)) {
      retentionInput.value = String(trashRetentionDays);
      clearRetentionError();
    }
  }

  function commitDurationInput() {
    if (!durationInput) return;
    const parsed = parseBoundedIntInput(
      durationInput.value,
      MIN_TOAST_DURATION_SECONDS,
      MAX_TOAST_DURATION_SECONDS,
    );
    if (!parsed.ok) {
      showDurationError();
      return;
    }
    clearDurationError();
    durationInput.value = String(parsed.value);
    if (store.getState().preferences.toastDurationSeconds !== parsed.value) {
      store.dispatch({ type: 'set_toast_duration', seconds: parsed.value });
    }
  }

  function commitRetentionInput() {
    if (!retentionInput) return;
    const parsed = parseBoundedIntInput(
      retentionInput.value,
      MIN_TRASH_RETENTION_DAYS,
      MAX_TRASH_RETENTION_DAYS,
    );
    if (!parsed.ok) {
      showRetentionError();
      return;
    }
    clearRetentionError();
    retentionInput.value = String(parsed.value);
    if (store.getState().preferences.trashRetentionDays !== parsed.value) {
      store.dispatch({ type: 'set_trash_retention_days', days: parsed.value });
    }
  }

  modalEl.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (target === durationInput) {
      commitDurationInput();
      return;
    }

    if (target === retentionInput) {
      commitRetentionInput();
      return;
    }

    if (target.type !== 'radio') return;
    const fieldset = target.closest('fieldset[data-input-screen]');
    if (!fieldset) return;
    const screenAttr = fieldset.getAttribute('data-input-screen');
    if (
      !screenAttr ||
      !INPUT_PRESENTATION_SCREENS.includes(/** @type {InputPresentationScreen} */ (screenAttr))
    ) {
      return;
    }
    const screen = /** @type {InputPresentationScreen} */ (screenAttr);
    const presentation = /** @type {InputPresentation} */ (
      target.value === 'modal' ? 'modal' : 'drawer'
    );
    store.dispatch({ type: 'set_input_presentation', screen, presentation });
  });

  durationInput?.addEventListener('input', () => {
    if (durationInput.getAttribute('aria-invalid') === 'true') {
      const parsed = parseBoundedIntInput(
        durationInput.value,
        MIN_TOAST_DURATION_SECONDS,
        MAX_TOAST_DURATION_SECONDS,
      );
      if (parsed.ok) {
        clearDurationError();
      }
    }
  });

  durationInput?.addEventListener('blur', () => {
    commitDurationInput();
  });

  retentionInput?.addEventListener('input', () => {
    if (retentionInput.getAttribute('aria-invalid') === 'true') {
      const parsed = parseBoundedIntInput(
        retentionInput.value,
        MIN_TRASH_RETENTION_DAYS,
        MAX_TRASH_RETENTION_DAYS,
      );
      if (parsed.ok) {
        clearRetentionError();
      }
    }
  });

  retentionInput?.addEventListener('blur', () => {
    commitRetentionInput();
  });

  modalEl.addEventListener('close', () => {
    syncControls({ forceDuration: true, forceRetention: true });
  });

  syncControls({ forceDuration: true, forceRetention: true });
  store.subscribe(({ command }) => {
    const forceDuration =
      command.type === 'hydrate' ||
      command.type === 'set_toast_duration' ||
      command.type === 'replace_all';
    const forceRetention =
      command.type === 'hydrate' ||
      command.type === 'set_trash_retention_days' ||
      command.type === 'replace_all';
    syncControls({ forceDuration, forceRetention });
  });
}
