// Types of `covenant.js`, the skill's script, which stays plain JavaScript (a copy, see the
// README). TypeScript resolves this file instead of the script, so the script is not checked.

type CovenantTextSize = 'auto' | 'standard' | 'comfortable' | 'large';
type CovenantStatus = 'success' | 'warning' | 'danger' | 'info';

interface CovenantApi {
  __loaded?: boolean;
  /** Wires the behaviours of every Covenant component below `root` (default: the document). */
  init?: (root?: ParentNode) => void;
  /** Shows a toast. `timeout` is in milliseconds, 0 keeps it until dismissed. */
  toast?: (opts: {
    status: CovenantStatus;
    title: string;
    text?: string;
    timeout?: number;
  }) => HTMLElement;
  setTextSize?: (size: CovenantTextSize) => CovenantTextSize;
  getTextSize?: () => CovenantTextSize;
  openDialog?: (id: string | HTMLDialogElement) => void;
  closeDialog?: (id: string | HTMLDialogElement) => void;
  /** Marker (light and dark) and fill colours derived from a picked colour. */
  categoryColors?: (hex: string) => { light: string; dark: string; fill: string } | null;
  /** `data-cat` 1 to 16, or a custom `#rrggbb`. */
  setCategory?: (element: Element | null, value: number | string) => unknown;
}

declare global {
  interface Window {
    Covenant?: CovenantApi;
  }
}

export {};
