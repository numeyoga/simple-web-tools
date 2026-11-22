// The few Node.js APIs that `vite.js` and its tests use, declared here instead of pulling in
// `@types/node` (which would also make the compiler check its dependencies' JavaScript).

declare module 'node:crypto' {
  export function createHash(algorithm: string): {
    update(data: string | Uint8Array): { update(data: string | Uint8Array): unknown };
    digest(encoding: 'hex'): string;
  };
}

declare module 'node:fs' {
  export function readdirSync(
    path: string,
    options: { recursive: boolean; withFileTypes: true },
  ): { name: string; parentPath: string; isFile(): boolean }[];
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readFileSync(path: string): Uint8Array;
  export function writeFileSync(path: string, data: string | Uint8Array): void;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function mkdtempSync(prefix: string): string;
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
}

declare module 'node:os' {
  export function tmpdir(): string;
}

declare module 'node:path' {
  export const sep: string;
  export function join(...parts: string[]): string;
  export function relative(from: string, to: string): string;
}
