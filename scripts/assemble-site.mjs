// Assembles the GitHub Pages site: each app's `dist/` is copied to `_site/<app>/`
// and a landing page listing the apps is generated at `_site/index.html`.
// Run after `npm run build` (or use `npm run site`, which does both).
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const appsDir = join(root, 'apps');
const outDir = join(root, '_site');

/** @param {string} value */
const escapeHtml = (value) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

/** @type {{ name: string, description: string }[]} */
const apps = [];
for (const name of readdirSync(appsDir).sort()) {
  const dist = join(appsDir, name, 'dist');
  if (!existsSync(dist)) {
    throw new Error(`apps/${name}/dist is missing: run \`npm run build\` first.`);
  }
  const pkg = JSON.parse(readFileSync(join(appsDir, name, 'package.json'), 'utf8'));
  cpSync(dist, join(outDir, name), { recursive: true });
  apps.push({ name, description: pkg.description ?? '' });
}

const items = apps
  .map(
    ({ name, description }) =>
      `      <li><a href="./${name}/">${escapeHtml(name)}</a><p>${escapeHtml(description)}</p></li>`,
  )
  .join('\n');

writeFileSync(
  join(outDir, 'index.html'),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="referrer" content="no-referrer" />
    <title>Simple Web Tools</title>
    <style>
      :root { color-scheme: light dark; font-family: system-ui, sans-serif; line-height: 1.5; }
      body { max-width: 40rem; margin: 3rem auto; padding: 0 1rem; }
      ul { list-style: none; padding: 0; }
      li { margin-block: 1.25rem; }
      a { font-size: 1.25rem; font-weight: 600; text-transform: capitalize; }
      p { margin: 0.25rem 0 0; opacity: 0.8; }
    </style>
  </head>
  <body>
    <h1>Simple Web Tools</h1>
    <p>Small local-first web apps. No backend, no account: your data stays in your browser.</p>
    <ul>
${items}
    </ul>
  </body>
</html>
`,
);

process.stdout.write(
  `Assembled ${apps.length} app(s) into _site/: ${apps.map((a) => a.name).join(', ')}\n`,
);
