// Types shared by the views and the Covenant primitives (ui.js). The views are plain DOM code:
// `el()` builds elements from a props object whose keys are attributes, properties, style and
// event handlers, so its values stay `unknown` and the helper narrows them.

import type { createStore } from '../store.js';

export type Store = ReturnType<typeof createStore>;

export type Child = Node | string | number | boolean | null | undefined | Child[];
export type Props = Record<string, unknown> | null | undefined;
export type Style = Record<string, string | number | null | undefined | false>;
export type DomEvent<T extends Element = HTMLElement> = Event & { currentTarget: T; target: T };

/**
 * A form field built by `Input`, `Textarea`, `Select` or `Combobox` (the FormField anatomy):
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

export interface TextareaOptions {
  label?: string;
  value?: string | null;
  placeholder?: string;
  hint?: string | null;
  maxLength?: number;
  rows?: number;
  className?: string;
  autoFocus?: boolean;
  oninput?: ((event: Event) => void) | null;
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

export interface ComboboxOptions {
  label?: string;
  value?: string;
  placeholder?: string;
  options?: string[];
  hint?: string | null;
  /** Shown in the list when no suggestion matches the text. */
  emptyText?: string;
  className?: string;
  onchange?: ((value: string) => void) | null;
  onkeydown?: ((event: KeyboardEvent) => void) | null;
  name?: string;
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
}

export interface ToastHost {
  push: (toast: ToastOptions) => void;
}

/** What `App.js` gives a view to open the quick-add dialog. */
export interface ViewOptions {
  onOpenQuickAdd: () => void;
  onStartOnProject: (projectId: string, description?: string) => void;
  onStartOnTodo: (projectId: string | null, description?: string) => void;
}

export interface View {
  el: HTMLElement;
  destroy?: () => void;
}

export interface QuickAddOptions {
  projectPrefill?: string | null;
  descriptionPrefill?: string;
  mode?: 'live' | 'manual';
  startPrefill?: number | null;
  endPrefill?: number | null;
  onStart?: (projectId: string) => void;
  onManualAdd?: (sessionId: string, projectId: string) => void;
}

export type ViewFactory = (store: Store, options: ViewOptions) => View;

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
