// tests/helpers/load.mjs — charge les scripts navigateur de public/js dans un
// contexte node:vm isolé, avec un faux `window` minimal (pas d'IndexedDB : le
// store bascule sur son repli localStorage). Aucune dépendance npm.
//
// Utilisation :
//   import { loadApp } from './helpers/load.mjs';
//   const app = loadApp();          // lib.js + db.js par défaut ; app === window
//   const store = app.createStore();
//   await store.init({ seedIfEmpty: false });
//
// `now` permet de figer Date.now() : loadApp({ now: Date.parse('2026-11-18T10:00') }).
// Le temps figé peut ensuite avancer via ctx.setNow(ts).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/js');

function fakeLocalStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    clear: () => m.clear(),
    get length() { return m.size; },
    key: i => [...m.keys()][i] ?? null,
  };
}

export function loadApp({ scripts = ['lib.js', 'db.js'], now = null } = {}) {
  let frozen = now;
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0 && frozen != null) super(frozen); else super(...a); }
    static now() { return frozen != null ? frozen : RealDate.now(); }
  }

  // Comme dans un navigateur, `window` EST l'objet global : `window.UI = …`
  // dans lib.js rend `UI` visible comme global dans db.js.
  const listeners = {};
  const ls = fakeLocalStorage();
  const ctx = {
    console, Date: FakeDate, Intl,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    localStorage: ls, location: { reload() {} },
    addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); },
    removeEventListener: (t, fn) => { listeners[t] = (listeners[t] || []).filter(f => f !== fn); },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const s of scripts) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), ctx, { filename: s });
  }
  // Les `function` / `const` de haut niveau des scripts deviennent globaux du contexte.
  ctx.setNow = ts => { frozen = ts; };
  ctx.fire = t => (listeners[t] || []).forEach(fn => fn({ type: t }));
  return ctx;
}
