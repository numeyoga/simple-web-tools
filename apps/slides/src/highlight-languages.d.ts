// The grammars of highlight.js are JavaScript files with JSDoc types that do not check under
// `--strict` (the package ships no declarations for them). `jsconfig.json` maps them here, so
// our code sees a typed grammar and the package's own files are not analysed.
declare const grammar: import('highlight.js').LanguageFn;
export default grammar;
