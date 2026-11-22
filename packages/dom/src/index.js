/**
 * The DOM helpers of the apps (decision 0004): the element builder that never parses HTML, and
 * the helpers around it. The Covenant component builders are in `@simple-web-tools/dom/ui`.
 */

export { appendChildren, createTNodes, el, fieldId, icon, initCovenant, mount } from './builder.js';

/** @typedef {import('./types.js').Child} Child */
/** @typedef {import('./types.js').Props} Props */
/** @typedef {import('./types.js').Style} Style */
/** @typedef {import('./types.js').DomEvent} DomEvent */
/** @typedef {import('./types.js').Field} Field */
/** @typedef {import('./types.js').ButtonOptions} ButtonOptions */
/** @typedef {import('./types.js').IconButtonOptions} IconButtonOptions */
/** @typedef {import('./types.js').IconButtonElement} IconButtonElement */
/** @typedef {import('./types.js').InputOptions} InputOptions */
/** @typedef {import('./types.js').TextareaOptions} TextareaOptions */
/** @typedef {import('./types.js').SelectOption} SelectOption */
/** @typedef {import('./types.js').SelectOptions} SelectOptions */
/** @typedef {import('./types.js').CheckboxOptions} CheckboxOptions */
/** @typedef {import('./types.js').SegmentedOptions} SegmentedOptions */
/** @typedef {import('./types.js').ComboboxOptions} ComboboxOptions */
/** @typedef {import('./types.js').BadgeOptions} BadgeOptions */
/** @typedef {import('./types.js').MenuItem} MenuItem */
/** @typedef {import('./types.js').MenuOptions} MenuOptions */
/** @typedef {import('./types.js').MenuHost} MenuHost */
/** @typedef {import('./types.js').ModalOptions} ModalOptions */
/** @typedef {import('./types.js').ModalHandle} ModalHandle */
/** @typedef {import('./types.js').ConfirmOptions} ConfirmOptions */
/** @typedef {import('./types.js').ToastOptions} ToastOptions */
/** @typedef {import('./types.js').ToastHost} ToastHost */
/** @typedef {import('./types.js').TargetEvent} TargetEvent */
/** @typedef {import('./types.js').TargetKeyEvent} TargetKeyEvent */
/** @typedef {import('./types.js').TargetMouseEvent} TargetMouseEvent */
