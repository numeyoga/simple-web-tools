import { describe, expect, it } from 'vitest';
import { PresentationError } from '../../src/core/errors.js';
import { imageTypeOf, pathInFolder, planFolder } from '../../src/core/folder.js';

describe('pathInFolder', () => {
  it('cuts the name of the folder the person chose', () => {
    expect(pathInFolder('talk/slides.md')).toBe('slides.md');
    expect(pathInFolder('My talk/assets/logo.png')).toBe('assets/logo.png');
  });

  it('keeps a name that has no folder', () => {
    expect(pathInFolder('slides.md')).toBe('slides.md');
  });
});

describe('imageTypeOf', () => {
  it('knows the image types, whatever the case of the extension', () => {
    expect(imageTypeOf('a.png')).toBe('image/png');
    expect(imageTypeOf('a.JPG')).toBe('image/jpeg');
    expect(imageTypeOf('dir/a.svg')).toBe('image/svg+xml');
    expect(imageTypeOf('a.webp')).toBe('image/webp');
  });

  it('refuses everything else', () => {
    for (const path of ['a.pdf', 'a.html', 'a', 'a.png.exe', '.png.bak']) {
      expect(imageTypeOf(path)).toBeNull();
    }
  });
});

describe('planFolder', () => {
  it('finds slides.md at the root and the images anywhere', () => {
    const plan = planFolder([
      'talk/notes.txt',
      'talk/slides.md',
      'talk/assets/a.png',
      'talk/deep/er/b.svg',
      'talk/readme.md',
    ]);
    expect(plan.mainIndex).toBe(1);
    expect(plan.assets).toEqual([
      { index: 2, path: 'assets/a.png', type: 'image/png' },
      { index: 3, path: 'deep/er/b.svg', type: 'image/svg+xml' },
    ]);
  });

  it('does not take a slides.md of a subfolder for the presentation', () => {
    expect(() => planFolder(['talk/old/slides.md', 'talk/readme.md'])).toThrowError(
      PresentationError,
    );
    try {
      planFolder(['talk/old/slides.md']);
    } catch (error) {
      expect(error).toMatchObject({ code: 'no-main-file' });
    }
  });

  it('fails on an empty folder', () => {
    expect(() => planFolder([])).toThrowError(/no-main-file/);
  });
});
