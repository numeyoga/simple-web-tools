// The colour of a group: the 16 category colours of Covenant, as a radio group of swatches. A
// colour never stands alone (WCAG 1.4.1): the selected swatch carries a check, and the name of
// the selected colour is written next to the legend. The value is the category number.
import { CATEGORIES } from '../../core/colors.js';
import { categoryName } from '../labels.js';
import * as UI from './ui.js';

const { el, icon, t } = UI;

/**
 * @param {{ name: string, value: number, onchange?: (category: number) => void }} options
 *   `name` is the name of the radio group (unique in the page)
 * @returns {{ element: HTMLFieldSetElement, readonly value: number }} the fieldset and the chosen category
 */
export function createColorPicker({ name, value, onchange }) {
  let current = value;
  const label = el('span', { class: 'fv-swatches__name' }, categoryName(current));
  const element = /** @type {HTMLFieldSetElement} */ (
    el(
      'fieldset',
      { class: 'fv-swatches' },
      el('legend', { class: 'cv-label' }, t('colors.label'), ' ', label),
      el(
        'div',
        { class: 'fv-swatches__list' },
        CATEGORIES.map((category) =>
          el(
            'label',
            { class: 'fv-swatch', 'data-cat': String(category) },
            el('input', {
              type: 'radio',
              name,
              value: String(category),
              checked: category === current,
              'aria-label': categoryName(category),
              onchange: () => {
                current = category;
                label.textContent = categoryName(category);
                onchange?.(category);
              },
            }),
            el('span', { class: 'fv-swatch__dot' }, icon('check', { weight: 'bold' })),
          ),
        ),
      ),
    )
  );
  return {
    element,
    get value() {
      return current;
    },
  };
}
