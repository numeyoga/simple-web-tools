# To do

Follow-ups found while adding Transient Notes (roadmap step 6). None of them blocks a release.

- [ ] **Locavern CSP: try removing `'unsafe-inline'` from `style-src`.** Tiptap no longer
      injects a `<style>` element (`injectCSS: false` in `packages/rich-text`, its base rules
      are in `editor.css`), which was one reason for it. Check what else needs inline styles
      (style attributes in markup, the whiteboard), then remove it and run Locavern's e2e suite
      with a `securitypolicyviolation` listener, as Chrono and Transient Notes do.
- [ ] **Share the DOM helpers.** `apps/transient-notes/src/adapters/dom/ui.js` and `lib.js` are
      trimmed copies of Chrono's (class prefix `tn-`). Two apps use them: move them to a
      package (decision 0004), with the no-`innerHTML` rule they enforce.
- [ ] **Move the tooltip fix into Covenant.** `apps/transient-notes/src/adapters/dom/tooltip.js`
      (`liftTooltip`, `placeTooltip`) puts tooltips in the top layer (Popover API) and picks the
      side with room, so they are no longer clipped by an overflowing sidebar or a transformed
      drawer. `packages/covenant` is a byte copy of the `covenant-design-system` skill: make
      the change in the skill, sync the package, then use it in all three apps and delete the
      app copy.
