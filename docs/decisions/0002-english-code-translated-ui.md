# 0002. English code and docs, translated user interface

Status: accepted, 2026-11-18

## Context

Chrono was written with French identifiers and a French interface; Locavern with English
identifiers and a French interface. A public repository is read by people who do not speak
French, and libraries and web APIs are named in English.

## Decision

- Identifiers, comments, JSDoc, commit messages and repository docs are in **English**.
- The user interface ships in **English and French**. Every user-facing string goes through a
  translation catalog. The language follows `navigator.language`, with a manual override that
  is saved.
- User documentation may exist in both languages. English is the reference version.

## Consequences

- Existing French identifiers are renamed when an app is ported, never piecemeal.
- Hard-coded interface strings are a review failure once an app has its catalog.
- A shared i18n package (message lookup, plurals with `Intl.PluralRules`, dates and numbers
  with `Intl`) is expected early, because every app needs it.
