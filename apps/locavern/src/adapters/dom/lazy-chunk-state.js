/**
 * What the page shows while a lazily loaded chunk (the rich-text editor, the whiteboard) is on
 * its way, and when it cannot be fetched. Texts come from the caller, from the catalogs.
 */

import { t } from '../i18n.js';

/**
 * Placeholder while a chunk loads: Covenant skeleton blocks, announced as busy.
 * @param {HTMLElement} container replaced by the placeholder
 * @param {string} label what loads, read by assistive technology
 */
export function showChunkLoading(container, label) {
  const box = document.createElement('div');
  box.className = 'lc-lazy-loading';
  box.setAttribute('aria-busy', 'true');
  const status = document.createElement('span');
  status.className = 'cv-sr-only';
  status.setAttribute('role', 'status');
  status.textContent = label;
  const lines = [
    'cv-skeleton cv-skeleton--title',
    'cv-skeleton cv-skeleton--text',
    'cv-skeleton cv-skeleton--text lc-lazy-loading__short',
  ].map((className) => {
    const line = document.createElement('span');
    line.className = className;
    return line;
  });
  box.append(status, ...lines);
  container.replaceChildren(box);
}

/**
 * Inline error when a chunk cannot be fetched: what failed, why, what to do next.
 * @param {HTMLElement} container replaced by the alert
 * @param {{ title: string; text: string }} message
 * @param {() => void} onRetry
 */
export function showChunkError(container, { title, text }, onRetry) {
  const alert = document.createElement('div');
  alert.className = 'cv-alert cv-alert--danger lc-lazy-error';
  alert.setAttribute('role', 'alert');
  const icon = document.createElement('i');
  icon.className = 'ph ph-x-circle cv-icon';
  icon.setAttribute('aria-hidden', 'true');
  const body = document.createElement('div');
  body.className = 'cv-alert__body';
  const lead = document.createElement('span');
  lead.className = 'cv-alert__title';
  lead.textContent = title;
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'cv-btn cv-btn--sm';
  retry.textContent = t('common.retry');
  retry.addEventListener('click', onRetry);
  body.append(lead, ` ${text} `, retry);
  alert.append(icon, body);
  container.replaceChildren(alert);
}
