import { LocavernError, failure } from './messages.js';

export const ENCRYPTED_ARCHIVE_FORMAT = 'locavern-encrypted-archive';
export const ENCRYPTED_ARCHIVE_VERSION = 1;
export const DEFAULT_PBKDF2_ITERATIONS = 310_000;
export const MIN_PBKDF2_ITERATIONS = 100_000;
export const MAX_PBKDF2_ITERATIONS = 2_000_000;

const ENCRYPTION_AAD_TEXT = `${ENCRYPTED_ARCHIVE_FORMAT}:v${ENCRYPTED_ARCHIVE_VERSION}`;
const SALT_BYTES = 16;
const IV_BYTES = 12;

/**
 * Copy any Uint8Array into a fresh Uint8Array backed by a concrete ArrayBuffer.
 * @param {Uint8Array} bytes
 * @returns {Uint8Array<ArrayBuffer>}
 */
function toConcreteBytes(bytes) {
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copy.set(bytes);
  return copy;
}

/**
 * Encode bytes into standard base64 without call-stack expansion.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

/**
 * Decode standard base64 string into concrete bytes, or null on invalid input.
 * @param {string} base64
 * @returns {Uint8Array<ArrayBuffer> | null}
 */
export function base64ToBytes(base64) {
  if (typeof base64 !== 'string' || base64.length === 0) return null;
  try {
    const binary = atob(base64);
    const out = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Ensure Web Crypto subtle & getRandomValues exist.
 * @returns {Crypto}
 */
function requireWebCrypto() {
  const webCrypto = globalThis.crypto;
  if (!webCrypto || typeof webCrypto.getRandomValues !== 'function' || !webCrypto.subtle) {
    throw new LocavernError('errors.encryption.webCryptoUnavailable');
  }
  return webCrypto;
}

/**
 * Derive a non-extractable AES-256-GCM key from a password and salt via PBKDF2-SHA-256.
 * @param {Crypto} webCrypto
 * @param {string} password
 * @param {Uint8Array<ArrayBuffer>} salt
 * @param {number} iterations
 * @param {KeyUsage[]} usages
 * @returns {Promise<CryptoKey>}
 */
async function deriveArchiveAesKey(webCrypto, password, salt, iterations, usages) {
  const encodedPassword = toConcreteBytes(new TextEncoder().encode(password));
  const baseKey = await webCrypto.subtle.importKey('raw', encodedPassword, 'PBKDF2', false, [
    'deriveKey',
  ]);
  return webCrypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  );
}

/**
 * @typedef {{
 *   format: 'locavern-encrypted-archive';
 *   version: 1;
 *   kdf: 'PBKDF2';
 *   hash: 'SHA-256';
 *   iterations: number;
 *   cipher: 'AES-GCM';
 *   keyLength: 256;
 *   salt: string;
 *   iv: string;
 * }} EncryptedArchiveHeader
 */

/**
 * Validate and normalize parsed encryption metadata from `encryption.json`.
 * @param {unknown} raw
 * @returns {
 *   | { ok: true; header: EncryptedArchiveHeader; saltBytes: Uint8Array<ArrayBuffer>; ivBytes: Uint8Array<ArrayBuffer> }
 *   | import('./messages.js').Failure
 * }
 */
export function parseEncryptionHeader(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return failure('errors.encryption.invalidHeader');
  }
  const obj = /** @type {Record<string, unknown>} */ (raw);
  if (obj.format !== ENCRYPTED_ARCHIVE_FORMAT) {
    return failure('errors.encryption.unknownFormat');
  }
  if (obj.version !== ENCRYPTED_ARCHIVE_VERSION) {
    return failure('errors.encryption.version', { version: String(obj.version) });
  }
  if (
    obj.kdf !== 'PBKDF2' ||
    obj.hash !== 'SHA-256' ||
    obj.cipher !== 'AES-GCM' ||
    obj.keyLength !== 256
  ) {
    return failure('errors.encryption.parameters');
  }
  const iterations = obj.iterations;
  if (
    typeof iterations !== 'number' ||
    !Number.isInteger(iterations) ||
    iterations < MIN_PBKDF2_ITERATIONS ||
    iterations > MAX_PBKDF2_ITERATIONS
  ) {
    return failure('errors.encryption.archiveIterations');
  }
  if (typeof obj.salt !== 'string' || typeof obj.iv !== 'string') {
    return failure('errors.encryption.missingSalt');
  }
  const saltBytes = base64ToBytes(obj.salt);
  const ivBytes = base64ToBytes(obj.iv);
  if (
    !saltBytes ||
    saltBytes.byteLength !== SALT_BYTES ||
    !ivBytes ||
    ivBytes.byteLength !== IV_BYTES
  ) {
    return failure('errors.encryption.corruptSalt');
  }

  return {
    ok: true,
    header: {
      format: ENCRYPTED_ARCHIVE_FORMAT,
      version: ENCRYPTED_ARCHIVE_VERSION,
      kdf: 'PBKDF2',
      hash: 'SHA-256',
      iterations,
      cipher: 'AES-GCM',
      keyLength: 256,
      salt: obj.salt,
      iv: obj.iv,
    },
    saltBytes,
    ivBytes,
  };
}

/**
 * Encrypt raw ZIP archive bytes using PBKDF2-SHA-256 + AES-256-GCM.
 * @param {Uint8Array} plainZipBytes
 * @param {string} password
 * @param {{ iterations?: number }} [options]
 * @returns {Promise<{ header: EncryptedArchiveHeader; ciphertext: Uint8Array<ArrayBuffer> }>}
 */
export async function encryptArchiveBytes(plainZipBytes, password, options = {}) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new LocavernError('errors.encryption.emptyPassword');
  }
  const iterations = options.iterations ?? DEFAULT_PBKDF2_ITERATIONS;
  if (
    !Number.isInteger(iterations) ||
    iterations < MIN_PBKDF2_ITERATIONS ||
    iterations > MAX_PBKDF2_ITERATIONS
  ) {
    throw new LocavernError('errors.encryption.iterationsOutOfRange');
  }

  const webCrypto = requireWebCrypto();
  const salt = new Uint8Array(new ArrayBuffer(SALT_BYTES));
  const iv = new Uint8Array(new ArrayBuffer(IV_BYTES));
  webCrypto.getRandomValues(salt);
  webCrypto.getRandomValues(iv);

  const key = await deriveArchiveAesKey(webCrypto, password, salt, iterations, ['encrypt']);
  const aad = toConcreteBytes(new TextEncoder().encode(ENCRYPTION_AAD_TEXT));
  const encryptedBuf = await webCrypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: aad,
      tagLength: 128,
    },
    key,
    toConcreteBytes(plainZipBytes),
  );

  return {
    header: {
      format: ENCRYPTED_ARCHIVE_FORMAT,
      version: ENCRYPTED_ARCHIVE_VERSION,
      kdf: 'PBKDF2',
      hash: 'SHA-256',
      iterations,
      cipher: 'AES-GCM',
      keyLength: 256,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
    },
    ciphertext: new Uint8Array(encryptedBuf),
  };
}

/**
 * Decrypt an encrypted archive payload given parsed header metadata, ciphertext bytes, and password.
 * @param {unknown} rawHeader
 * @param {Uint8Array} ciphertextBytes
 * @param {string} password
 * @returns {Promise<
 *   | { ok: true; plaintextZipBytes: Uint8Array<ArrayBuffer> }
 *   | (import('./messages.js').Failure & { wrongPassword?: boolean })
 * >}
 */
export async function decryptArchiveBytes(rawHeader, ciphertextBytes, password) {
  const parsedHeader = parseEncryptionHeader(rawHeader);
  if (!parsedHeader.ok) {
    return parsedHeader;
  }
  if (!(ciphertextBytes instanceof Uint8Array) || ciphertextBytes.byteLength < 16) {
    return failure('errors.encryption.missingData');
  }
  if (typeof password !== 'string' || password.length === 0) {
    return { ...failure('errors.encryption.enterPassword'), wrongPassword: true };
  }

  const webCrypto = requireWebCrypto();
  try {
    const key = await deriveArchiveAesKey(
      webCrypto,
      password,
      parsedHeader.saltBytes,
      parsedHeader.header.iterations,
      ['decrypt'],
    );
    const aad = toConcreteBytes(new TextEncoder().encode(ENCRYPTION_AAD_TEXT));
    const plainBuf = await webCrypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: parsedHeader.ivBytes,
        additionalData: aad,
        tagLength: 128,
      },
      key,
      toConcreteBytes(ciphertextBytes),
    );
    return { ok: true, plaintextZipBytes: new Uint8Array(plainBuf) };
  } catch {
    return { ...failure('errors.encryption.wrongPassword'), wrongPassword: true };
  }
}
