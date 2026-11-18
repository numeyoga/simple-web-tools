import { defineConfig } from 'vite';

const PROD_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** @returns {import('vite').Plugin} */
function cspMetaPlugin() {
  return {
    name: 'locavern-csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      const metaTag = `    <meta http-equiv="Content-Security-Policy" content="${PROD_CSP}" />\n`;
      return html.replace(/(<meta\s+charset=["']utf-8["']\s*\/?>)/i, `$1\n${metaTag}`);
    },
    generateBundle(_options, bundle) {
      const assetUrls = Object.keys(bundle)
        .filter((fileName) => fileName !== 'sw.js' && fileName !== 'precache-manifest.json')
        .map((fileName) => `./${fileName}`);
      this.emitFile({
        type: 'asset',
        fileName: 'precache-manifest.json',
        source: JSON.stringify(assetUrls, null, 2),
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [cspMetaPlugin()],
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  server: {
    headers: {
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  },
  preview: {
    headers: {
      'Content-Security-Policy': PROD_CSP,
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  },
});
