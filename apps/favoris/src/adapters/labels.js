// The translated texts that the core takes as arguments or that views share: the names of the
// 16 category colours. The keys are written out one by one (never built from a variable) so that
// the catalog test can check them.

import { t } from './i18n.js';

/**
 * The name of a category colour (Covenant's palette, in hue order). A colour is never shown
 * alone: its name is next to every marker.
 * @param {number} category 1 to 16
 * @returns {string}
 */
export function categoryName(category) {
  switch (category) {
    case 1:
      return t('colors.orange');
    case 2:
      return t('colors.amber');
    case 3:
      return t('colors.yellow');
    case 4:
      return t('colors.lime');
    case 5:
      return t('colors.green');
    case 6:
      return t('colors.teal');
    case 7:
      return t('colors.cyan');
    case 8:
      return t('colors.sky');
    case 9:
      return t('colors.blue');
    case 10:
      return t('colors.indigo');
    case 11:
      return t('colors.violet');
    case 12:
      return t('colors.purple');
    case 13:
      return t('colors.fuchsia');
    case 14:
      return t('colors.pink');
    case 15:
      return t('colors.rose');
    default:
      return t('colors.slate');
  }
}
