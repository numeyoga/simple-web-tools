---
title: Sanitizer
theme: light
---

# Hostile slide

<img src="x" onerror="window.__pwned = 'img'">

<script>window.__pwned = 'script'</script>

[markdown link](javascript:window.__pwned='link')

<a href="JaVaScRiPt:window.__pwned='link2'" onclick="window.__pwned='click'">mixed case</a>

<div onmouseover="window.__pwned='hover'" style="position:fixed;inset:0">overlay</div>

<iframe src="https://example.com/frame"></iframe>

<form action="https://evil.example/post"><input name="x"><button>Send</button></form>

<svg onload="window.__pwned = 'svg'"><script>window.__pwned = 'svgscript'</script></svg>

![remote image](https://example.com/tracker.png)

![local image](assets/ok.png)

![missing image](assets/nope.png)

[a safe link](https://example.org/page)

:::notes-presenter
<img src="y" onerror="window.__pwned = 'notes'">Careful notes.
:::

---

# Second slide

Nothing to see.
