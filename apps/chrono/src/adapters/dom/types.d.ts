// Types shared by the views and the Covenant primitives (ui.js). The views are plain DOM code:
// `el()` builds elements from a props object whose keys are attributes, properties, style and
// event handlers, so its values stay `unknown` and the helper narrows them.

import type { createStore } from '../store.js';

export type Store = ReturnType<typeof createStore>;

export type Child = Node | string | number | boolean | null | undefined | Child[];
export type Props = Record<string, unknown> | null | undefined;
export type Style = Record<string, string | number | null | undefined | false>;
export type DomEvent<T extends Element = HTMLElement> = Event & { currentTarget: T; target: T };

/** A labelled field built by `Input`, `Textarea` or `Select`: `input` is the control itself. */
export type Field<T extends HTMLElement = HTMLInputElement> = HTMLLabelElement & { input: T };

export interface ButtonOptions {
  variant?: string;
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  iconRight?: string;
  children?: Child;
  disabled?: boolean;
  onclick?: ((event: MouseEvent) => void) | null;
  type?: 'button' | 'submit';
  style?: Style;
  title?: string;
  /** The button changes data: it is disabled in a read-only tab. */
  mutates?: boolean;
}

export interface IconButtonOptions {
  icon: string;
  label: string;
  onclick?: ((event: MouseEvent) => void) | null;
  variant?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  weight?: string;
  title?: string;
  style?: Style;
  mutates?: boolean;
}

export interface InputOptions {
  label?: string;
  value?: string | number | null;
  placeholder?: string;
  type?: string;
  error?: string | null;
  hint?: string | null;
  icon?: string;
  style?: Style;
  autoFocus?: boolean;
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
  style?: Style;
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
  value?: string | null;
  options: SelectOption[];
  onchange?: ((value: string) => void) | null;
  style?: Style;
  size?: 'sm' | 'md';
  name?: string;
}

export interface AutocompleteOptions {
  label?: string;
  value?: string;
  placeholder?: string;
  options?: string[];
  hint?: string | null;
  autoFocus?: boolean;
  style?: Style;
  onchange?: ((value: string) => void) | null;
  onkeydown?: ((event: KeyboardEvent) => void) | null;
  name?: string;
}

export interface BadgeOptions {
  variant?: string;
  dot?: boolean;
  children?: Child;
  style?: Style;
}

export interface ModalOptions {
  title: string;
  body: Child;
  footer?: Child;
  width?: number;
  onclose?: (() => void) | null;
}

export interface ModalHandle {
  close: () => void;
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
