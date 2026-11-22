# Simple Web Tools

Small, focused web apps that run entirely in your browser.

- **No backend, no account, no tracking.** Your data stays on your device, in IndexedDB.
- **Offline-ready:** apps install as PWAs and keep working without a network.
- **Yours to keep:** every app can export its data to a file and import it back.
- **No runtime framework.** Plain HTML, CSS and modern JavaScript, built with Vite.

## Apps

| App                                      | What it does                                                                       | Status                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------ |
| [Locavern](apps/locavern/)               | Personal productivity: projects, tasks, Kanban, calendar, notes, SVG whiteboard.   | Reference (English, French)    |
| [Chrono](apps/chrono/)                   | Time tracking: projects, sessions, presence clock, weekly report, to-dos.          | Ported (English and French)    |
| [Transient Notes](apps/transient-notes/) | Notes sorted with the PARA method: folders, rich text, images, search, workspaces. | Rewritten (English and French) |
| [Favoris](apps/favoris/)                 | Bookmarks in colour groups: workspaces, drag and drop, search, JSON backup.        | Rewritten (English and French) |
| [Dashboard](apps/dashboard/)             | The links of your applications, built from templates, per environment.             | Rewritten (English and French) |
| [Slides](apps/slides/)                   | Markdown presentations from a folder: presenter window, overview, print, diagrams. | Ported (English and French)    |

The apps are published together on GitHub Pages, one sub-path per app.

## Getting started

Requirements: Node.js 26 (see [`.nvmrc`](.nvmrc)) and npm.

```bash
npm install            # installs every workspace
npm run verify         # typecheck, lint, format check, unit tests, build
npm run test:e2e       # browser tests (Playwright)
npm run site           # builds every app and assembles the Pages site in _site/
```

Work on a single app with npm workspaces, for example `npm run dev -w locavern`.

## Repository layout

```text
apps/<app>/        one folder per app, each with its own README and tests
packages/<name>/   code shared by the apps (design system, storage, i18n, rich text, app links, offline shell, DOM helpers…), added as it is extracted
docs/              architecture decisions, roadmap and cross-app guides
scripts/           repository tooling (Pages site assembly)
```

## Documentation

- [Architecture decisions](docs/decisions/) explain why the repository works the way it does.
- [Roadmap](docs/roadmap.md) lists the convergence work between the apps.
- [Moving your data to the new address](docs/moving-your-data.md) is for existing Chrono users.
- [Contributing](CONTRIBUTING.md) and [security policy](SECURITY.md).

## License

[MIT](LICENSE). Third-party assets keep their own licenses, noted next to them
(Phosphor Icons: MIT; IBM Plex fonts: SIL Open Font License 1.1).
