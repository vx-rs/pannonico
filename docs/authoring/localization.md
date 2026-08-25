# Localization

Pannonico resolves page languages, generates reciprocal translation links, and
implements `t` and cardinal `plural`. Localization preflight and rendering are
in-memory operations; they do not inspect or mutate output.

## Language metadata

Pannonico uses `data/languages.yaml` when the conventional file exists. The
`localization.languagesFile` configuration setting may select another `.yaml`
or `.yml` file inside the project root.

The file is an object keyed by BCP 47 language code:

```yaml
en:
  title: English
  pluralLocale: en
sr:
  title: Srpski
  pluralLocale: sr
ar:
  title: العربية
  pluralLocale: ar
  dir: rtl
```

Each entry accepts only:

- `title`: non-empty display label;
- `pluralLocale`: non-empty BCP 47 locale for cardinal rules;
- `dir`: exact `ltr` or `rtl`.

Missing `title` and `pluralLocale` values default to the canonical language
code. Metadata does not form an allowlist. A valid page code absent from the
file also uses its canonical code as label and plural locale.

Language codes use canonical BCP 47 spelling. Equivalent authored keys such as
`en` and `EN` collide. Invalid YAML, unknown fields, invalid tags, invalid
directions, non-object entries, source changes, and symlinks fail localization
preflight.

## Language precedence

Pannonico resolves one page language in this order:

1. page frontmatter `lang`;
2. selected layout frontmatter `lang`;
3. `localization.defaultLanguage`;
4. unset.

For `layout: none`, layout language is unavailable. A page may remain unset
when it does not use `t`, `plural`, or `translationKey`. A locale-dependent
helper fails at its template source position when language is unset.
`translationKey` without language fails preflight.

Resolved metadata appears under `.pannonico.language`:

```yaml
code: ar
label: العربية
pluralLocale: ar
dir: rtl
```

The value is null when language is unset. `dir` is absent when metadata does
not define it.

## Translation groups

Translated pages declare the same exact key and distinct languages:

```yaml
lang: en
translationKey: about
```

```yaml
lang: sr
translationKey: about
```

Every grouped page must have a resolved language and output identity. One
canonical language may occur only once in a group. A conflict reports the
first source plus every related page and produces no links for the invalid
group.

`.pannonico.translations` excludes the current page. Links sort by canonical
language code, root-relative URL, and source identity:

```yaml
- code: ar
  label: العربية
  url: /ar/about.html
- code: sr
  label: Srpski
  url: /sr/about.html
```

Pannonico exposes link data rather than fixed markup:

```html
<nav aria-label="Translations">
  <ul>
    {{range .pannonico.translations}}
      <li><a href="{{.url}}" lang="{{.code}}">{{.label}}</a></li>
    {{end}}
  </ul>
</nav>
```

## Translation helper

`t` accepts a language-keyed object of strings:

```yaml
heading:
  en: About us
  sr: O nama
  ar: من نحن
```

```html
<h1>{{t .data.labels.heading}}</h1>
<h1>{{t .data.labels.heading "en"}}</h1>
```

Resolution order is:

1. current canonical page language;
2. the optional explicit fallback;
3. `en`;
4. the first non-empty value ordered by canonical language code;
5. empty string when every valid value is empty.

The helper accepts at most one explicit fallback. Dictionary language codes
must be valid and unique after canonicalization, and every value must be a
string. Invalid input stops rendering.

## Cardinal plural helper

`plural` accepts a count and a language-keyed category object:

```yaml
items:
  en:
    one: "{{count}} item"
    other: "{{count}} items"
  sr:
    one: "{{count}} stavka"
    few: "{{count}} stavke"
    other: "{{count}} stavki"
```

```html
<p>{{plural .page.count .data.labels.items}}</p>
```

The helper uses `.pannonico.language.pluralLocale`, falling back internally to
the language code only when that field is absent. It supports `zero`, `one`,
`two`, `few`, `many`, and `other`. When the selected category has no non-empty
value, it uses non-empty `other`; otherwise rendering fails.

Counts may be template integer constants, JSON numbers, finite numeric values,
or signed decimal/scientific values.
Category selection uses the absolute number while literal `{{count}}` markers
receive the original count text, including a sign or visible fraction digits.
Substitution is not recursive template execution.

To bound work before the plural engine runs, count text is limited to 512
bytes, the mantissa to 256 digits, and the scientific exponent to -1000 through
1000. Values outside those limits fail clearly instead of being truncated.

The product uses `golang.org/x/text v0.40.0` cardinal tables, which identify
CLDR 32. Pin the Pannonico version when exact plural-category compatibility is
required. A later 0.x release may update these tables with matching migration
notes; strict cross-version compatibility begins with 1.0.0.

## Escaping and migration

`t` and `plural` return ordinary strings. `html/template` contextually escapes
translation text and substituted counts. Language metadata and link values are
also ordinary JSON-compatible strings.

Replace a legacy translation-markup helper with an explicit loop over
`.pannonico.translations`. Replace legacy translation lookup with `t`, and
replace named plural arguments with the language/category dictionary shown
above.
