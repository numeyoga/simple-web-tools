# 0008. Opt-in third-party requests

Status: accepted, 2026-11-22

## Context

The apps make no third-party request. Their strict Content Security Policy, the single origin
they share (decision 0005) and the bundled assets (decision 0007) all rely on that. Favoris,
ported in roadmap step 8, shows each site's icon through Google's favicon service
(`https://www.google.com/s2/favicons`). That is one request per link, and it tells Google which
domains a person bookmarks. A future sync (roadmap step 12) would also contact a server.

## Decision

A feature may contact a third party only when all of these hold:

1. It is off by default, and the person turns it on in the preferences.
2. The setting names the host and says what the host learns, for example "Google sees the
   domains of your links".
3. The app's CSP allows that host only in the directive the feature needs, for example
   `img-src https://www.google.com`, and nowhere else. The app's README lists the host and the
   reason.
4. The app works fully with the feature off, and turning it off stops the requests at once.
5. The choice is stored like the other preferences, with the app prefix (decision 0005).

A third party never provides a script, a stylesheet or a font. Those stay bundled (decision 0007).

## Consequences

- Favoris gets a "Load site icons from Google" preference, off by default. Until it is on, each
  link shows a coloured initial instead.
- The end-to-end suite checks that no request leaves the origin while the preference is off.
- A sync, if it is added, follows the same rules and gets its own record for its backend.
