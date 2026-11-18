import { describe, it, expect } from 'vitest';
import {
  DEFAULT_WHITEBOARD_GRID_SIZE,
  computeFitViewport,
  detachUnfollowedArrowBindings,
  duplicateWhiteboardElements,
  findArrowSnapTarget,
  getArrowWorldEndpoints,
  intersectRayWithElementBorder,
  recomputeBoundArrows,
  selectElementsInMarquee,
  snapPointToGrid,
  snapValueToGrid,
  stepValueWithGrid,
} from '../../src/core/whiteboard.js';

describe('whiteboard core helpers', () => {
  it('duplique la sélection multiple en conservant l’ordre z et en décalant les copies', () => {
    /** @type {import('../../src/types.d.ts').WhiteboardElement[]} */
    const elements = [
      {
        id: 'a',
        type: 'sticky',
        x: 10,
        y: 20,
        width: 100,
        height: 80,
        color: 'accent',
        zIndex: 0,
        text: 'A',
      },
      { id: 'b', type: 'rect', x: 200, y: 40, width: 120, height: 90, color: 'neutral', zIndex: 1 },
      {
        id: 'c',
        type: 'arrow',
        x: 50,
        y: 120,
        width: 80,
        height: 20,
        color: 'danger',
        zIndex: 2,
        points: [
          [0, 10],
          [80, 10],
        ],
      },
    ];
    let seq = 0;
    const res = duplicateWhiteboardElements(elements, new Set(['c', 'a']), {
      generateId: () => `dup-${++seq}`,
      offset: 24,
    });

    expect(res.createdIds).toEqual(['dup-1', 'dup-2']);
    expect(res.nextElements).toHaveLength(5);
    expect(res.nextElements[3]).toMatchObject({
      id: 'dup-1',
      type: 'sticky',
      x: 34,
      y: 44,
      zIndex: 3,
      text: 'A',
    });
    expect(res.nextElements[4]).toMatchObject({
      id: 'dup-2',
      type: 'arrow',
      x: 74,
      y: 144,
      zIndex: 4,
      points: [
        [0, 10],
        [80, 10],
      ],
    });
  });

  it('calcule un viewport ajusté à la vue pour centrer des éléments éloignés ou très étendus', () => {
    expect(computeFitViewport([], 800, 500)).toEqual({ panX: 0, panY: 0, zoom: 1 });

    /** @type {import('../../src/types.d.ts').WhiteboardElement[]} */
    const farEls = [
      {
        id: 'e1',
        type: 'rect',
        x: 1000,
        y: 800,
        width: 200,
        height: 100,
        color: 'accent',
        zIndex: 0,
      },
    ];
    const fitSmall = computeFitViewport(farEls, 800, 500);
    expect(fitSmall.zoom).toBe(1);
    expect(fitSmall.panX).toBe(-700);
    expect(fitSmall.panY).toBe(-600);

    /** @type {import('../../src/types.d.ts').WhiteboardElement[]} */
    const wideEls = [
      {
        id: 'w1',
        type: 'rect',
        x: 0,
        y: 0,
        width: 1600,
        height: 1000,
        color: 'neutral',
        zIndex: 0,
      },
    ];
    const fitWide = computeFitViewport(wideEls, 800, 500, 48);
    expect(fitWide.zoom).toBeLessThan(1);
    expect(fitWide.zoom).toBeGreaterThanOrEqual(0.25);
  });

  it('sélectionne uniquement les éléments intersectant un rectangle de sélection', () => {
    /** @type {import('../../src/types.d.ts').WhiteboardElement[]} */
    const elements = [
      {
        id: 'in-1',
        type: 'sticky',
        x: 50,
        y: 50,
        width: 100,
        height: 80,
        color: 'accent',
        zIndex: 0,
      },
      {
        id: 'edge-2',
        type: 'rect',
        x: 180,
        y: 120,
        width: 100,
        height: 80,
        color: 'neutral',
        zIndex: 1,
      },
      {
        id: 'out-3',
        type: 'ellipse',
        x: 500,
        y: 500,
        width: 80,
        height: 80,
        color: 'success',
        zIndex: 2,
      },
    ];
    expect(selectElementsInMarquee(elements, { x: 40, y: 40, width: 150, height: 100 })).toEqual([
      'in-1',
      'edge-2',
    ]);
  });

  it('aimante les extrémités de flèche aux ancres des formes et au centre', () => {
    /** @type {import('../../src/types.d.ts').WhiteboardElement[]} */
    const elements = [
      {
        id: 's1',
        type: 'rect',
        x: 100,
        y: 100,
        width: 120,
        height: 80,
        color: 'accent',
        zIndex: 0,
      },
      {
        id: 'e1',
        type: 'ellipse',
        x: 320,
        y: 100,
        width: 100,
        height: 100,
        color: 'success',
        zIndex: 1,
      },
    ];

    const nearRight = findArrowSnapTarget(elements, { x: 228, y: 142 });
    expect(nearRight?.binding).toEqual({ elementId: 's1', anchor: 'right' });
    expect(nearRight?.point).toEqual({ x: 220, y: 140 });

    const insideEllipse = findArrowSnapTarget(elements, { x: 370, y: 150 });
    expect(insideEllipse?.binding).toEqual({ elementId: 'e1', anchor: 'center' });
    expect(insideEllipse?.point).toEqual({ x: 370, y: 150 });

    expect(findArrowSnapTarget(elements, { x: 20, y: 20 })).toBeNull();

    const [rectEl, ellipseEl] = elements;
    if (!rectEl || !ellipseEl) throw new Error('missing elements');
    const borderRect = intersectRayWithElementBorder(rectEl, { x: 300, y: 140 });
    expect(borderRect).toEqual({ x: 220, y: 140 });
    const borderEllipse = intersectRayWithElementBorder(ellipseEl, { x: 170, y: 150 });
    expect(Math.round(borderEllipse.x)).toBe(320);
    expect(Math.round(borderEllipse.y)).toBe(150);
  });

  it('recalcule les flèches aimantées quand les formes bougent, sont supprimées ou dupliquées', () => {
    /** @type {import('../../src/types.d.ts').WhiteboardElement[]} */
    const elements = [
      {
        id: 'box-1',
        type: 'sticky',
        x: 100,
        y: 100,
        width: 100,
        height: 80,
        color: 'accent',
        zIndex: 0,
      },
      {
        id: 'box-2',
        type: 'rect',
        x: 400,
        y: 100,
        width: 120,
        height: 80,
        color: 'neutral',
        zIndex: 1,
      },
      {
        id: 'arr-1',
        type: 'arrow',
        x: 200,
        y: 132,
        width: 200,
        height: 16,
        color: 'accent',
        points: [
          [0, 8],
          [200, 8],
        ],
        startBinding: { elementId: 'box-1', anchor: 'right' },
        endBinding: { elementId: 'box-2', anchor: 'left' },
        zIndex: 2,
      },
    ];

    // Move box-2 downward & rightward -> arrow end endpoint must follow
    const moved = recomputeBoundArrows(
      elements.map((el) => (el.id === 'box-2' ? { ...el, x: 460, y: 200 } : el)),
    );
    const arrowAfterMove = moved.find((el) => el.id === 'arr-1');
    expect(arrowAfterMove).toBeDefined();
    const [p1, p2] = getArrowWorldEndpoints(/** @type {any} */ (arrowAfterMove));
    expect(p1).toEqual({ x: 200, y: 140 });
    expect(p2).toEqual({ x: 460, y: 240 });

    // Moving arrow alone detaches unfollowed bindings, moving all together preserves them
    const movedArrowAlone = detachUnfollowedArrowBindings(elements, new Set(['arr-1']));
    expect(movedArrowAlone[2]?.startBinding).toBeUndefined();
    expect(movedArrowAlone[2]?.endBinding).toBeUndefined();

    const movedTogether = detachUnfollowedArrowBindings(
      elements,
      new Set(['box-1', 'box-2', 'arr-1']),
    );
    expect(movedTogether[2]?.startBinding).toEqual({ elementId: 'box-1', anchor: 'right' });
    expect(movedTogether[2]?.endBinding).toEqual({ elementId: 'box-2', anchor: 'left' });

    // Deleting box-2 strips endBinding while preserving startBinding
    const afterDelete = recomputeBoundArrows(elements.filter((el) => el.id !== 'box-2'));
    const arrowAfterDelete = afterDelete.find((el) => el.id === 'arr-1');
    expect(arrowAfterDelete?.startBinding).toEqual({ elementId: 'box-1', anchor: 'right' });
    expect(arrowAfterDelete?.endBinding).toBeUndefined();

    // Duplicating box-1, box-2 and arr-1 remaps arrow bindings onto the cloned boxes
    let seq = 0;
    const dupRes = duplicateWhiteboardElements(elements, new Set(['box-1', 'box-2', 'arr-1']), {
      generateId: () => `clone-${++seq}`,
      offset: 30,
    });
    const clonedArrow = dupRes.nextElements.find((el) => el.id === 'clone-3');
    expect(clonedArrow?.startBinding).toEqual({ elementId: 'clone-1', anchor: 'right' });
    expect(clonedArrow?.endBinding).toEqual({ elementId: 'clone-2', anchor: 'left' });
  });

  it('aimante coordonnées, pas clavier et duplications sur la grille lorsque le magnétisme est actif', () => {
    expect(DEFAULT_WHITEBOARD_GRID_SIZE).toBe(20);
    expect(snapValueToGrid(31, 20, true)).toBe(40);
    expect(snapValueToGrid(29, 20, true)).toBe(20);
    expect(snapValueToGrid(-12, 20, true)).toBe(-20);
    expect(snapValueToGrid(-3, 20, true)).toBe(0);
    expect(Object.is(snapValueToGrid(-3, 20, true), -0)).toBe(false);
    expect(snapValueToGrid(31.4, 20, false)).toBe(31);

    expect(snapPointToGrid({ x: 52, y: 108 }, 20, true)).toEqual({ x: 60, y: 100 });
    expect(snapPointToGrid({ x: 52.2, y: 108.7 }, 20, false)).toEqual({ x: 52, y: 109 });

    expect(stepValueWithGrid(13, 1, { snapEnabled: true })).toBe(20);
    expect(stepValueWithGrid(20, 1, { snapEnabled: true })).toBe(40);
    expect(stepValueWithGrid(23, -1, { snapEnabled: true })).toBe(20);
    expect(stepValueWithGrid(20, -1, { snapEnabled: true })).toBe(0);
    expect(stepValueWithGrid(13, 1, { snapEnabled: false })).toBe(23);

    /** @type {import('../../src/types.d.ts').WhiteboardElement[]} */
    const elements = [
      {
        id: 's1',
        type: 'sticky',
        x: 13,
        y: 27,
        width: 120,
        height: 80,
        color: 'accent',
        zIndex: 0,
      },
    ];
    const dup = duplicateWhiteboardElements(elements, new Set(['s1']), {
      generateId: () => 's2',
      snapGridSize: 20,
    });
    expect(dup.nextElements[1]).toMatchObject({ id: 's2', x: 40, y: 40 });
  });
});
