// Small pieces the views share: a card with a heading, a field row of a table, the screen reader
// text of a move button.
import * as UI from './ui.js';

const { el, fieldId } = UI;

/**
 * The focus key of a control: the parts joined (`field:2:label`). A control that is drawn again
 * gets the focus back when its key is the same.
 * @param {...(string | number)} parts
 * @returns {string}
 */
export function focusKey(...parts) {
  return parts.join(':');
}

/**
 * A card: a heading (an `h2` of the screen), an optional subtitle and actions, then the body.
 * @param {{ title: string, subtitle?: string, actions?: import('./types.js').Child, body: import('./types.js').Child,
 *   flush?: boolean, className?: string }} options `flush`: the body has no padding (a table)
 * @returns {HTMLElement}
 */
export function card({ title, subtitle, actions, body, flush = false, className = '' }) {
  const headingId = fieldId('dsh-card');
  return el(
    'section',
    { class: className ? `dsh-card ${className}` : 'dsh-card', 'aria-labelledby': headingId },
    el(
      'header',
      { class: 'dsh-card__head' },
      el(
        'div',
        { class: 'dsh-grow dsh-stack dsh-gap-1' },
        el('h2', { class: 'cv-h4', id: headingId }, title),
        subtitle ? el('p', { class: 'dsh-meta' }, subtitle) : null,
      ),
      actions ? el('div', { class: 'dsh-row dsh-wrap dsh-gap-2' }, actions) : null,
    ),
    el('div', { class: flush ? 'dsh-card__flush' : 'dsh-card__body' }, body),
  );
}

/**
 * A table in its scroll region: a real table with a caption, and a region that can be focused so
 * a keyboard user can scroll it (the Covenant DataTable).
 * @param {{ caption: string, columns: string[], rows: import('./types.js').Child[][], hideCaption?: boolean }} options
 * @returns {HTMLElement}
 */
export function dataTable({ caption, columns, rows, hideCaption = true }) {
  const captionId = fieldId('dsh-table');
  return el(
    'div',
    { class: 'cv-table-wrap', role: 'region', 'aria-labelledby': captionId, tabindex: 0 },
    el(
      'table',
      { class: 'cv-table dsh-table' },
      el('caption', { id: captionId, class: hideCaption ? 'cv-sr-only' : '' }, caption),
      el(
        'thead',
        null,
        el(
          'tr',
          null,
          columns.map((column) => el('th', { scope: 'col' }, column)),
        ),
      ),
      el(
        'tbody',
        null,
        rows.map((cells) =>
          el(
            'tr',
            null,
            cells.map((cell) => el('td', null, cell)),
          ),
        ),
      ),
    ),
  );
}

/**
 * A text field that commits when the person leaves it or presses Enter (`change`), not on every
 * key: the data and the views that show it are not rebuilt while someone types.
 * @param {{ label: string, value: string, focusKey: string, mono?: boolean, placeholder?: string,
 *   type?: string, visibleLabel?: boolean, onCommit: (value: string, field: import('./types.js').Field) => void }} options
 *   `label` names the field; it is shown only with `visibleLabel`
 * @returns {import('./types.js').Field}
 */
export function commitInput({
  label,
  value,
  focusKey,
  mono = false,
  placeholder,
  type,
  visibleLabel = false,
  onCommit,
}) {
  const field = UI.Input({
    ...(visibleLabel ? { label } : { ariaLabel: label }),
    value,
    mono,
    placeholder,
    type,
  });
  field.input.dataset.focusKey = focusKey;
  field.input.setAttribute('data-mutates', '');
  field.input.addEventListener('change', () => onCommit(field.input.value, field));
  return field;
}

/**
 * A select that commits at once.
 * @param {{ label: string, value: string, focusKey: string, options: { value: string, label: string }[],
 *   visibleLabel?: boolean, onCommit: (value: string) => void }} options
 * @returns {ReturnType<typeof UI.Select>}
 */
export function commitSelect({ label, value, focusKey, options, visibleLabel = false, onCommit }) {
  const field = UI.Select({
    ...(visibleLabel ? { label } : { ariaLabel: label }),
    value,
    options,
    onchange: onCommit,
    mutates: true,
  });
  field.input.dataset.focusKey = focusKey;
  return field;
}
