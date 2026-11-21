// Ids and timestamps are made here, at the edge, and passed into the core as arguments.

/** A new random id (a UUID). `crypto.randomUUID` needs a secure context: the fallback does not. */
export function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

/** The current time as an ISO 8601 timestamp, the format of `createdAt` and `updatedAt`. */
export function nowIso() {
  return new Date().toISOString();
}
