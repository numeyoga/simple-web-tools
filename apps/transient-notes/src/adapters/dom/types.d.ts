// Types shared by the views and the Covenant primitives (ui.js). The views are plain DOM code:
// `el()` builds elements from a props object whose keys are attributes, properties, style and
// event handlers, so its values stay `unknown` and the helper narrows them.

import type { AppStore } from '../store.js';

export type Store = AppStore;

export type Child = Node | string | number | boolean | null | undefined | Child[];
export type Props = Record<string, unknown> | null | undefined;
export type Style = Record<string, string | number | null | undefined | false>;
export type DomEvent<T extends Element = HTMLElement> = Event & { currentTarget: T; target: T };

/**
 * A form field built by `Input` or `Select` (the FormField anatomy):
 * `input` is the control itself and `setError` shows or clears the error text under it.
 */
export type Field<T extends HTMLElement = HTMLInputElement> = HTMLDivElement & {
  input: T;
  setError: (message: string | null | undefined) => void;
};

export interface ButtonOptions {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: string;
  children?: Child;
  disabled?: boolean;
  onclick?: ((event: MouseEvent) => void) | null;
  type?: 'button' | 'submit';
  /** Extra app classes (layout only). */
  className?: string;
  /** The button changes data: it is disabled in a read-only tab. */
  mutates?: boolean;
  autoFocus?: boolean;
}

export interface IconButtonOptions {
  icon: string;
  /** Names the button (`aria-label`) and fills its tooltip. */
  label: string;
  onclick?: ((event: MouseEvent) => void) | null;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  disabled?: boolean;
  weight?: 'regular' | 'bold';
  className?: string;
  mutates?: boolean;
}

/** The tooltip wrapper of an icon-only button; the button itself is `button`. */
export type IconButtonElement = HTMLSpanElement & { button: HTMLButtonElement };

export interface InputOptions {
  label?: string;
  /** The name of a field that has no visible label. */
  ariaLabel?: string;
  value?: string | number | null;
  placeholder?: string;
  type?: string;
  error?: string | null;
  hint?: string | null;
  icon?: string;
  className?: string;
  autoFocus?: boolean;
  /** IBM Plex Mono, for codes, durations and amounts. */
  mono?: boolean;
  required?: boolean;
  oninput?: ((event: Event) => void) | null;
  onkeydown?: ((event: KeyboardEvent) => void) | null;
  onblur?: ((event: Event) => void) | null;
  name?: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectOptions {
  label?: string;
  /** The name of a select that has no visible label. */
  ariaLabel?: string;
  value?: string | null;
  options: SelectOption[];
  hint?: string | null;
  onchange?: ((value: string) => void) | null;
  className?: string;
  name?: string;
  mutates?: boolean;
}

export interface CheckboxOptions {
  label?: string;
  /** The name of a checkbox that has no visible label. */
  ariaLabel?: string;
  checked?: boolean;
  onchange?: ((checked: boolean, event: Event) => void) | null;
  mutates?: boolean;
  /** Draws the Switch (`role="switch"`) instead of the checkbox. */
  switchRole?: boolean;
  className?: string;
}

export interface SegmentedOptions {
  /** Visually hidden, announced. */
  legend: string;
  name: string;
  options: SelectOption[];
  value: string;
  onchange: (value: string) => void;
}

export interface BadgeOptions {
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
  children?: Child;
}

export type MenuItem =
  | { separator: true }
  | {
      label: string;
      icon: string;
      onclick: () => void;
      /** A destructive item: shown in the danger colour, placed last after a separator. */
      danger?: boolean;
      /** The item changes data: it is disabled in a read-only tab. */
      mutates?: boolean;
    };

export interface MenuOptions {
  /** Names the button (`aria-label`). */
  label: string;
  /** Names the menu (default: `label`). */
  menuLabel?: string;
  icon: string;
  /** A visible text beside the icon; without it the button is icon-only, with a tooltip. */
  text?: string;
  items: MenuItem[];
  size?: 'sm' | 'md';
}

/** The host of a menu button and its popover; `button` opens `menu`. */
export type MenuHost = HTMLSpanElement & { button: HTMLButtonElement; menu: HTMLElement };

export interface ModalOptions {
  title: string;
  body: Child;
  footer?: Child;
  onclose?: (() => void) | null;
}

export interface ModalHandle {
  /** The native `<dialog>`. */
  root: HTMLDialogElement;
  close: () => void;
  /** Replaces the content in place and returns a function that restores the previous one. */
  replaceContent: (content: { title: string; body: Child; footer?: Child }) => () => void;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  /** The label of the action, a verb (default: Confirm, translated). */
  confirmLabel?: string;
  /** A destructive action: the confirm button is the danger button. */
  danger?: boolean;
  /** Ask inside this modal instead of opening a second one. */
  within?: ModalHandle;
}

export interface ToastOptions {
  variant?: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  body?: string | null;
  /** Milliseconds before it leaves; `0` keeps it until it is dismissed. Default: Covenant's. */
  timeout?: number;
  /** A button under the text; `onclick` gets the button. */
  action?: { label: string; onclick: (button: HTMLButtonElement) => void };
}

export interface ToastHost {
  push: (toast: ToastOptions) => HTMLElement | undefined;
}

/** The handlers of the views read `event.target` as the control that fired the event. */
export type TargetEvent = Event & { target: HTMLInputElement; currentTarget: HTMLInputElement };
export type TargetKeyEvent = KeyboardEvent & {
  target: HTMLInputElement;
  currentTarget: HTMLInputElement;
};
export type TargetMouseEvent = MouseEvent & {
  target: HTMLInputElement;
  currentTarget: HTMLInputElement;
};

/** A view of the main region: its root element, and what to do when it is replaced. */
export interface View {
  el: HTMLElement;
  destroy?: () => void;
  /** Called once the element is in the document (menus and tooltips need it to be wired). */
  mounted?: () => void;
}
