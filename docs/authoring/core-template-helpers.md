# Core template helpers

Pannonico provides `pageIs`, `date`, `has`, and `get`; equality, negation, list
iteration, and integer repetition use native Go template features.
Localization helpers are documented in [`localization.md`](localization.md).
The safe `markdown` helper is documented with the complete Markdown contract in
[`markdown.md`](markdown.md).

Helper text remains untrusted. `html/template` contextually escapes every
string returned by `date`, `get`, `t`, or `plural`.

## Page matching

`pageIs` receives `.pannonico` and one or more exact candidates:

```html
{{if pageIs .pannonico "index" "manual"}}
  ...
{{end}}

{{if not (pageIs .pannonico "index")}}
  ...
{{end}}
```

A candidate containing `/` matches `.pannonico.pagePath`. A candidate without
`/` matches `.pannonico.pageName`. For `pages/manual/topic.html`, both of these
match:

```html
{{pageIs .pannonico "manual/topic"}}
{{pageIs .pannonico "topic"}}
```

Backslashes are normalized to `/` in both the candidate and generated page
metadata. No other normalization occurs: matching remains case-sensitive and
exact, and dot segments are not cleaned. An empty candidate list or malformed
`.pannonico` page metadata stops template execution with a source-positioned
error.

## Build date

The build coordinator captures one date at build start. It converts the build
start to UTC unless a non-empty `SOURCE_DATE_EPOCH` supplies signed Unix
seconds, then stores the result as `YYYY-MM-DD` in immutable build metadata.
Invalid epochs and years that cannot be represented with four digits fail
capture. Every page and layout in that build receives the same value.

`date` formats only that captured value:

```html
{{date "YYYY"}}
{{date "MM"}}
{{date "DD"}}
{{date "YYYY-MM-DD"}}
{{date "DD.MM.YYYY"}}
{{date "MM/DD/YYYY"}}
```

The supported tokens are exact uppercase `YYYY`, `MM`, and `DD`. Tokens may be
adjacent or repeated. Separators and ordinary words are preserved, so
`{{date "Built YYYY-MM-DD"}}` is valid. All-uppercase date-symbol words and
common repeated or multi-letter lower/mixed-case date spellings are interpreted
as date syntax and must consist entirely of the three supported uppercase
tokens. Values such as `YY`, `yyyy`, `MMM`, `HH:mm`, and `ZZ` fail clearly;
ordinary words such as `My` remain literal. V1 does not format arbitrary dates,
times, timezones, or locales.

## Migration from legacy helpers

Replace legacy equality helpers with native `eq`:

```html
{{if eq .page.kind "manual"}}
  ...
{{end}}
```

Replace `ifpage` and `unlesspage` with `pageIs`, native `if`, and native `not`:

```html
{{if pageIs .pannonico "manual/topic"}}
  ...
{{end}}

{{if not (pageIs .pannonico "index")}}
  ...
{{end}}
```

Replace a legacy list helper with native `range` and explicit punctuation:

```html
{{range $index, $item := .page.items}}{{if $index}}, {{end}}{{$item}}{{end}}
```

Replace a repeat helper with Go integer range:

```html
{{range 5}}
  <span>Repeated</span>
{{end}}
```

Integer range starts at zero and stops before the integer. Zero and negative
integers execute no iterations. Pannonico does not change native behavior or
apply a helper-specific cap; large values should therefore be used
deliberately.
