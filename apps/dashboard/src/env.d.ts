/// <reference types="vite/client" />

// Side-effect imports of stylesheets (bundled by Vite) have no types.
declare module '*.css';
