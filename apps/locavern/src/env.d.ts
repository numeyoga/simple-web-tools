/// <reference types="vite/client" />

declare module '@phosphor-icons/web/regular';
declare module '@phosphor-icons/web/bold';

type CovenantTextSize = 'auto' | 'standard' | 'comfortable' | 'large';

interface CovenantApi {
  __loaded?: boolean;
  init?: (root?: ParentNode) => void;
  toast?: (opts: {
    status: 'success' | 'warning' | 'danger' | 'info';
    title: string;
    text?: string;
    timeout?: number;
  }) => HTMLElement;
  setTextSize?: (size: CovenantTextSize) => CovenantTextSize;
  getTextSize?: () => CovenantTextSize;
  openDialog?: (id: string | HTMLDialogElement) => void;
  closeDialog?: (id: string | HTMLDialogElement) => void;
}

interface Window {
  Covenant?: CovenantApi;
}
