// `fake-indexeddb/auto` ships no declaration that TypeScript resolves through the package
// exports, so it would pull the package's untyped sources into the typecheck. jsconfig.json
// maps the specifier here: the import is only for its side effect.
export {};
