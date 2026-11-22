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
  /**
   * Gives a trigger a tooltip (`data-cv-tooltip`), or changes its text; an empty text removes it.
   * Wired at once when the trigger is in the document, else by `init(container)`.
   */
  setTooltip?: (trigger: Element | null | undefined, text: string) => void;
  /** Hides the tooltip being shown (a view changes, a menu or a dialog opens). */
  hideTooltips?: () => void;
  /** Where a tooltip of `size` goes against `anchor` in `viewport`: pure, in client pixels. */
  placeTooltip?: (
    anchor: { left: number; top: number; right: number; bottom: number },
    size: { width: number; height: number },
    viewport: { width: number; height: number },
    prefer?: 'top' | 'bottom',
    gap?: number,
  ) => { left: number; top: number; side: 'top' | 'bottom' };
}

declare global {
  interface Window {
    Covenant?: CovenantApi;
  }
}

export {};
