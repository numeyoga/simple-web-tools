// Generic JSON export envelope: { app, format, version, exportedAt, data }. The app owns the
// shape of `data`; the package owns the checks around it. Time is an argument (decision 0004).

/**
 * @typedef {object} ExportEnvelope
 * @property {string} app app that wrote the file
 * @property {string} format name of the app's export format, for example `chrono-workspace`
 * @property {number} version format version, a positive integer
 * @property {string} exportedAt ISO 8601 timestamp, given by the caller
 * @property {unknown} data
 */

/**
 * @typedef {'invalid-json' | 'not-an-envelope' | 'wrong-app' | 'wrong-format' | 'invalid-version' | 'newer-version' | 'unsupported-version' | 'upgrade-failed'} ExportErrorCode
 */

/** Raised by `parseExport` with a machine-readable `code` and a readable message. */
export class ExportError extends Error {
  /**
   * @param {ExportErrorCode} code
   * @param {string} message
   * @param {unknown} [cause]
   */
  constructor(code, message, cause) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ExportError';
    this.code = code;
  }
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isVersion(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

/**
 * Build an export envelope.
 * @param {{ app: string; format: string; version: number; exportedAt: string; data: unknown }} input
 * @returns {ExportEnvelope}
 */
export function createExportEnvelope({ app, format, version, exportedAt, data }) {
  if (typeof app !== 'string' || app === '') throw new TypeError('An export needs an app name.');
  if (typeof format !== 'string' || format === '') {
    throw new TypeError('An export needs a format name.');
  }
  if (!isVersion(version)) throw new TypeError('An export version is a positive integer.');
  if (typeof exportedAt !== 'string' || Number.isNaN(Date.parse(exportedAt))) {
    throw new TypeError('exportedAt must be an ISO 8601 timestamp string.');
  }
  return { app, format, version, exportedAt, data };
}

/**
 * Serialize an envelope as pretty-printed JSON.
 * @param {ExportEnvelope} envelope
 * @returns {string}
 */
export function serializeExport(envelope) {
  return JSON.stringify(envelope, null, 2);
}

/**
 * Step that upgrades the `data` of an export from one version to the next.
 * @callback ExportUpgrade
 * @param {unknown} data
 * @returns {unknown}
 */

/**
 * @typedef {object} ParseExportOptions
 * @property {string} app expected app
 * @property {string} format expected format
 * @property {number} version current version of the format
 * @property {Readonly<Record<number, ExportUpgrade>>} [upgrades] `upgrades[n]` turns the data
 *   of version `n` into version `n + 1`. Every older version still accepted needs its steps.
 */

/**
 * Parse and validate an export file. Older versions are upgraded step by step to the current
 * one; newer versions, other apps and other formats are rejected with an `ExportError`.
 * @param {string | unknown} input JSON text, or an already parsed value
 * @param {ParseExportOptions} options
 * @returns {ExportEnvelope & { originalVersion: number }} the envelope at the current version
 */
export function parseExport(input, { app, format, version, upgrades = {} }) {
  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch (error) {
      throw new ExportError('invalid-json', 'The file is not valid JSON.', error);
    }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ExportError('not-an-envelope', 'The file is not an export: expected a JSON object.');
  }
  const record = /** @type {Record<string, unknown>} */ (value);
  if (record.app !== app) {
    throw new ExportError(
      'wrong-app',
      `This file was exported by ${describe(record.app)}, not by ${app}.`,
    );
  }
  if (record.format !== format) {
    throw new ExportError(
      'wrong-format',
      `Unexpected export format ${describe(record.format)}: expected ${format}.`,
    );
  }
  const fileVersion = record.version;
  if (!isVersion(fileVersion)) {
    throw new ExportError(
      'invalid-version',
      `The export version ${describe(fileVersion)} is not a positive integer.`,
    );
  }
  if (fileVersion > version) {
    throw new ExportError(
      'newer-version',
      `This export has version ${fileVersion}, newer than the ${version} this app reads. Update the app and try again.`,
    );
  }
  if (typeof record.exportedAt !== 'string' || Number.isNaN(Date.parse(record.exportedAt))) {
    throw new ExportError('not-an-envelope', 'The export has no valid exportedAt timestamp.');
  }
  if (typeof record.data !== 'object' || record.data === null) {
    throw new ExportError('not-an-envelope', 'The export has no data section.');
  }

  /** @type {unknown} */
  let data = record.data;
  for (let step = fileVersion; step < version; step += 1) {
    const upgrade = upgrades[step];
    if (!upgrade) {
      throw new ExportError(
        'unsupported-version',
        `Export version ${fileVersion} cannot be upgraded: no step from version ${step}.`,
      );
    }
    try {
      data = upgrade(data);
    } catch (error) {
      throw new ExportError(
        'upgrade-failed',
        `Upgrading the export from version ${step} to ${step + 1} failed.`,
        error,
      );
    }
  }
  return {
    app,
    format,
    version,
    exportedAt: record.exportedAt,
    data,
    originalVersion: fileVersion,
  };
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function describe(value) {
  return typeof value === 'string' ? `"${value}"` : value === undefined ? 'nothing' : String(value);
}
