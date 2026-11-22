// Types shared by the views and the Covenant primitives (ui.js). Those of the element builder and
// of the component builders are `@simple-web-tools/dom`'s, re-exported so that the views import
// them from here.

import type { AppStore } from '../store.js';

export type Store = AppStore;

export type {
  Child,
  Props,
  Style,
  DomEvent,
  Field,
  ButtonOptions,
  IconButtonOptions,
  IconButtonElement,
  InputOptions,
  SelectOption,
  SelectOptions,
  CheckboxOptions,
  SegmentedOptions,
  BadgeOptions,
  MenuItem,
  MenuOptions,
  MenuHost,
  ModalOptions,
  ModalHandle,
  ConfirmOptions,
  ToastOptions,
  ToastHost,
  TargetEvent,
  TargetKeyEvent,
  TargetMouseEvent,
} from '@simple-web-tools/dom';

/** A view of the main region: its root element, and what to do when it is replaced. */
export interface View {
  el: HTMLElement;
  destroy?: () => void;
  /** Called once the element is in the document (menus and tooltips need it to be wired). */
  mounted?: () => void;
}
