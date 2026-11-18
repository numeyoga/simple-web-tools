import { describe, it, expect } from 'vitest';
import { ExportError, createExportEnvelope, parseExport, serializeExport } from '../src/index.js';

const exportedAt = '2026-11-18T10:00:00.000Z';
const options = { app: 'chrono', format: 'chrono-workspace', version: 1 };
const envelope = createExportEnvelope({
  ...options,
  exportedAt,
  data: { projects: [{ id: 'p1' }] },
});

/** @param {() => unknown} fn */
function codeOf(fn) {
  try {
    fn();
  } catch (error) {
    return error instanceof ExportError ? error.code : `other: ${error}`;
  }
  return 'no error';
}

describe('export envelope', () => {
  it('round-trips through JSON text', () => {
    const parsed = parseExport(serializeExport(envelope), options);
    expect(parsed).toEqual({ ...envelope, originalVersion: 1 });
  });

  it('accepts an already parsed value', () => {
    expect(parseExport(envelope, options).data).toEqual({ projects: [{ id: 'p1' }] });
  });

  it('keeps the exact field set', () => {
    expect(Object.keys(envelope)).toEqual(['app', 'format', 'version', 'exportedAt', 'data']);
  });

  it('refuses to build an envelope with a bad version or timestamp', () => {
    expect(() => createExportEnvelope({ ...options, version: 0, exportedAt, data: {} })).toThrow(
      TypeError,
    );
    expect(() => createExportEnvelope({ ...options, exportedAt: 'yesterday', data: {} })).toThrow(
      TypeError,
    );
    expect(() =>
      createExportEnvelope({ ...options, exportedAt: /** @type {any} */ (Date), data: {} }),
    ).toThrow(TypeError);
  });
});

describe('parseExport rejections', () => {
  it.each([
    ['invalid JSON', '{nope', 'invalid-json'],
    ['a JSON array', '[]', 'not-an-envelope'],
    ['null', 'null', 'not-an-envelope'],
    ['another app', { ...envelope, app: 'locavern' }, 'wrong-app'],
    ['no app', { ...envelope, app: undefined }, 'wrong-app'],
    ['another format', { ...envelope, format: 'locavern-archive' }, 'wrong-format'],
    ['a string version', { ...envelope, version: '1' }, 'invalid-version'],
    ['version 0', { ...envelope, version: 0 }, 'invalid-version'],
    ['a fractional version', { ...envelope, version: 1.5 }, 'invalid-version'],
    ['a newer version', { ...envelope, version: 2 }, 'newer-version'],
    ['no timestamp', { ...envelope, exportedAt: undefined }, 'not-an-envelope'],
    ['no data', { ...envelope, data: undefined }, 'not-an-envelope'],
    ['null data', { ...envelope, data: null }, 'not-an-envelope'],
  ])('rejects %s', (_label, input, code) => {
    expect(codeOf(() => parseExport(input, options))).toBe(code);
  });

  it('names both apps in the wrong-app message', () => {
    expect(() => parseExport({ ...envelope, app: 'locavern' }, options)).toThrow(
      /locavern.*chrono/,
    );
  });
});

describe('older versions', () => {
  const current = { ...options, version: 3 };
  const old = createExportEnvelope({ ...options, version: 1, exportedAt, data: { n: 1 } });

  it('upgrades step by step, in order', () => {
    /** @type {number[]} */
    const calls = [];
    const parsed = parseExport(old, {
      ...current,
      upgrades: {
        1: (data) => (calls.push(1), { .../** @type {object} */ (data), step1: true }),
        2: (data) => (calls.push(2), { .../** @type {object} */ (data), step2: true }),
      },
    });
    expect(calls).toEqual([1, 2]);
    expect(parsed).toMatchObject({
      version: 3,
      originalVersion: 1,
      data: { n: 1, step1: true, step2: true },
    });
  });

  it('only runs the steps from the file version', () => {
    const v2 = { ...old, version: 2 };
    /** @type {number[]} */
    const calls = [];
    parseExport(v2, {
      ...current,
      upgrades: { 1: () => calls.push(1), 2: (d) => (calls.push(2), d) },
    });
    expect(calls).toEqual([2]);
  });

  it('rejects a version with no upgrade path', () => {
    expect(codeOf(() => parseExport(old, { ...current, upgrades: { 2: (d) => d } }))).toBe(
      'unsupported-version',
    );
  });

  it('wraps an upgrade failure', () => {
    const boom = new Error('boom');
    try {
      parseExport(old, {
        ...current,
        upgrades: {
          1: () => {
            throw boom;
          },
          2: (d) => d,
        },
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ExportError);
      const exportError = /** @type {ExportError} */ (error);
      expect(exportError.code).toBe('upgrade-failed');
      expect(exportError.cause).toBe(boom);
    }
  });
});

describe('coexistence with Locavern archives', () => {
  it('rejects a Locavern archive manifest as another format', () => {
    const manifest = { format: 'locavern-archive', version: 1, exportedAt, data: {} };
    expect(codeOf(() => parseExport(manifest, options))).toBe('wrong-app');
  });
});
