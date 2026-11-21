// Puts a Covenant tooltip in the top layer. Covenant draws it with `position: absolute` inside
// its wrapper, so any ancestor that scrolls or clips (the sidebar's overflow, the editor pane)
// cuts it off. Here the tooltip becomes a manual popover: it is shown and hidden along with the
// `hidden` attribute that Covenant already toggles (hover, focus, Escape), and placed with
// `position: fixed` from the rect of its trigger, on the side that has room.

/** Gap between the trigger and the tooltip, in px at the standard text scale. */
const GAP = 8;
/** Smallest distance kept from the edge of the window. */
const MARGIN = 4;
/** The popover mode that stays open until it is hidden (the `hidden` attribute drives it). */
const MANUAL = 'manual';
/** The attribute Covenant toggles to show and hide a tooltip. */
const HIDDEN = 'hidden';
/** The side a tooltip opens on by default. @type {'top'} */
const ABOVE = 'top';

/**
 * Where a box of `size` goes against `anchor` in a window of `viewport`: centred on the anchor
 * and clamped horizontally, above or below it. The preferred side is kept when the box fits
 * there, else the other side is used when it fits, else the side with more room.
 * @param {{ left: number, top: number, right: number, bottom: number }} anchor
 * @param {{ width: number, height: number }} size
 * @param {{ width: number, height: number }} viewport
 * @param {'top' | 'bottom'} prefer
 * @param {number} [gap]
 * @returns {{ left: number, top: number, side: 'top' | 'bottom' }}
 */
export function placeTooltip(anchor, size, viewport, prefer, gap = GAP) {
  const above = anchor.top - gap - size.height;
  const below = anchor.bottom + gap;
  const fitsAbove = above >= MARGIN;
  const fitsBelow = below + size.height <= viewport.height - MARGIN;
  /** @type {'top' | 'bottom'} */
  let side = prefer;
  if (prefer === 'top' && !fitsAbove && fitsBelow) side = 'bottom';
  else if (prefer === 'bottom' && !fitsBelow && fitsAbove) side = 'top';
  else if (!fitsAbove && !fitsBelow) {
    side = anchor.top > viewport.height - anchor.bottom ? 'top' : 'bottom';
  }
  const centre = (anchor.left + anchor.right) / 2 - size.width / 2;
  const left = Math.max(MARGIN, Math.min(centre, viewport.width - size.width - MARGIN));
  return { left, top: side === 'top' ? above : below, side };
}

/**
 * Lifts the tooltip of a `cv-tooltip-wrap` into the top layer. Call it once per wrapper, before
 * or after Covenant wires it.
 * @param {HTMLElement} wrap the `cv-tooltip-wrap`
 * @param {'top' | 'bottom'} [prefer] the side tried first
 */
export function liftTooltip(wrap, prefer = ABOVE) {
  const found = /** @type {HTMLElement | null} */ (wrap.querySelector('[role="tooltip"]'));
  // No Popover API: the tooltip keeps Covenant's own placement.
  if (!found || typeof found.showPopover !== 'function' || found.dataset.lifted) return;
  const tip = found;
  tip.dataset.lifted = '';
  tip.popover = MANUAL;

  function place() {
    const size = { width: tip.offsetWidth, height: tip.offsetHeight };
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const { left, top } = placeTooltip(
      wrap.getBoundingClientRect(),
      size,
      { width: window.innerWidth, height: window.innerHeight },
      prefer,
      (GAP * rem) / 16,
    );
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  /** The anchor moves with a scroll or a resize while the tooltip is shown. */
  const follow = () => place();

  function sync() {
    const open = tip.matches(':popover-open');
    if (tip.hidden) {
      if (!open) return;
      tip.hidePopover();
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
      return;
    }
    if (!open) {
      tip.showPopover();
      window.addEventListener('scroll', follow, true);
      window.addEventListener('resize', follow);
    }
    place();
  }

  new MutationObserver(sync).observe(tip, { attributes: true, attributeFilter: [HIDDEN] });
  sync();
}
