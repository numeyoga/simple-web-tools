# To do

Follow-ups found while adding Transient Notes (roadmap step 6). None of them blocks a release.

- [ ] **Locavern CSP: try removing `'unsafe-inline'` from `style-src`.** Tiptap no longer
      injects a `<style>` element (`injectCSS: false` in `packages/rich-text`, its base rules
      are in `editor.css`), which was one reason for it. Check what else needs inline styles
      (style attributes in markup, the whiteboard), then remove it and run Locavern's e2e suite
      with a `securitypolicyviolation` listener, as Chrono and Transient Notes do.
