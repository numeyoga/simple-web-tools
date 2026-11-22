// Types shared by the views and the Covenant primitives (ui.js). Those of the element builder and
// of the component builders are `@simple-web-tools/dom`'s, re-exported so that the views import
// them from here.

import type { Route } from '../../core/route.js';
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
  /** The title of the page (the `h1`) while this view is shown. */
  title: () => string;
}

/** What every view gets from the shell. */
export interface Context {
  store: Store;
  toasts: import('@simple-web-tools/dom').ToastHost;
  /** Goes to a screen (changes the address). */
  navigate: (route: Route) => void;
  /** The workspace this tab shows. */
  workspaceId: string;
}
