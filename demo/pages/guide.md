---
title: Demo workflow
inlineCSS: false
---

<main class="demo-shell">

# One manifest, two runtimes

Vite transpiles the TypeScript entry and compiles its imported SCSS. Pannonico
then reads Vite's manifest and renders the same template under its native and
WASI runtimes. The HTML examples choose whether that production stylesheet is
kept as a link or selected for Pro inlining through ordinary page data.

The Pro renderer also expands HTML, H~2~O, 29^th^, ==highlighted text==,
++inserted text++, and ~~deleted text~~. This sentence has a named note[^rich]
and an inline note^[Rendered by the same plugin composition.].

::: Build Note
The demo owns the presentation of this parsed **Markdown container**.
:::

```
const answer: number = 42
```

```ts
const answer: number = 42
```

[Return to the demo](/)

*[HTML]: Hyper Text Markup Language

[^rich]: Rich Markdown is available in native and WASI Pro artifacts.

</main>
