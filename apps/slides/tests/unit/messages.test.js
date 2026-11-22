import { describe, expect, it } from 'vitest';
import { Commands, parseMessage } from '../../src/core/messages.js';
import { parsePresentation } from '../../src/core/parser.js';

const presentation = parsePresentation('# A\n---\n# B');
const state = {
  type: 'STATE',
  presentation,
  assets: { 'assets/a.png': 'blob:http://127.0.0.1:4178/abc' },
  currentIndex: 1,
};

describe('parseMessage', () => {
  it('accepts a STATE, after a round trip through structured clone', () => {
    expect(parseMessage(structuredClone(state))).toEqual(state);
  });

  it('accepts SYNC, REQUEST_STATE and the three COMMANDs', () => {
    expect(parseMessage({ type: 'SYNC', currentIndex: 3 })).toEqual({
      type: 'SYNC',
      currentIndex: 3,
    });
    expect(parseMessage({ type: 'REQUEST_STATE' })).toEqual({ type: 'REQUEST_STATE' });
    expect(parseMessage(Commands.next)).toEqual(Commands.next);
    expect(parseMessage(Commands.previous)).toEqual(Commands.previous);
    expect(parseMessage(Commands.goto(4))).toEqual({ type: 'COMMAND', action: 'goto', index: 4 });
  });

  it('refuses what is not an object, and unknown types', () => {
    for (const data of [null, undefined, 'STATE', 42, [], { type: 'EVAL' }, {}, { type: 7 }]) {
      expect(parseMessage(data)).toBeNull();
    }
  });

  it('refuses a SYNC or a go-to with an index that is not a whole number from 0', () => {
    for (const index of [-1, 1.5, '2', null, Number.NaN, Infinity]) {
      expect(parseMessage({ type: 'SYNC', currentIndex: index })).toBeNull();
      expect(parseMessage({ type: 'COMMAND', action: 'goto', index })).toBeNull();
    }
    expect(parseMessage({ type: 'COMMAND', action: 'goto' })).toBeNull();
  });

  it('refuses an unknown command', () => {
    expect(parseMessage({ type: 'COMMAND', action: 'close' })).toBeNull();
  });

  it('refuses a STATE whose presentation is malformed', () => {
    const broken = [
      { ...state, presentation: null },
      { ...state, presentation: { ...presentation, slides: [] } },
      { ...state, presentation: { ...presentation, slides: [{ html: 3 }] } },
      { ...state, presentation: { ...presentation, meta: { ...presentation.meta, theme: 'red' } } },
      {
        ...state,
        presentation: { ...presentation, meta: { ...presentation.meta, ratio: 'wide' } },
      },
      { ...state, presentation: { meta: presentation.meta } },
      { ...state, currentIndex: 2 },
      { ...state, currentIndex: -1 },
    ];
    for (const message of broken) expect(parseMessage(message)).toBeNull();
  });

  it('refuses a STATE that points an image at anything but an object URL', () => {
    for (const url of [
      'https://evil.example/a.png',
      'data:image/png;base64,AA',
      'javascript:x',
      3,
    ]) {
      expect(parseMessage({ ...state, assets: { 'a.png': url } })).toBeNull();
    }
    expect(parseMessage({ ...state, assets: null })).toBeNull();
  });
});
