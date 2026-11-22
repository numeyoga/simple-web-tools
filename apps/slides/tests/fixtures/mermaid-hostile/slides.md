# Hostile label

```mermaid
graph LR
  A["<img src=x onerror='window.__pwned=1'>Label"] --> B
  click B call alert(1)
```
