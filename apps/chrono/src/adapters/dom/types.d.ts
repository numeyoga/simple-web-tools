// Types shared by the views and the Covenant primitives (ui.js). The views are plain DOM code:
// `el()` builds elements from a props object whose keys are attributes, properties, style and
// event handlers, so its values stay `unknown` and the helper narrows them.

import type { createStore } from '../store.js';

export type Store = ReturnType<typeof createStore>;

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
  TextareaOptions,
  SelectOption,
  SelectOptions,
  CheckboxOptions,
  SegmentedOptions,
  ComboboxOptions,
  BadgeOptions,
  ModalOptions,
  ModalHandle,
  ConfirmOptions,
  ToastOptions,
  ToastHost,
} from '@simple-web-tools/dom';

export type { TargetEvent, TargetKeyEvent, TargetMouseEvent } from '@simple-web-tools/dom';

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
