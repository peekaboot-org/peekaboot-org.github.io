---
title: Theming
lead: One stylesheet, three surfaces &mdash; tokens.css is the whole override point.
permalink: /docs/theming/
---

## One file, three surfaces

The dashboard document, the dev toolbar, and the trace-detail overlay all load the exact
same `tokens.css` from `/peekaboot/ui/assets/tokens.css`. The toolbar and overlay each
render inside their own shadow root, isolated from the page's own styles, but they link
the identical file into it too, so the same set of custom properties reaches all three
surfaces from one place &mdash; you don't need to override anything twice.

Overriding those `--pk-*` custom properties re-themes all three surfaces at once. There's
nothing else to override for colour: no component style hardcodes a colour outside these
tokens.

## How to override it

Peekaboot serves `tokens.css` as a resource handler mapped at `/peekaboot/ui/**` onto
`classpath:/META-INF/peekaboot/ui/`, with caching disabled. That is deliberately outside
every location Spring Boot serves static files from, so an application with Peekaboot off
serves none of the bundle. Overriding it is classpath shadowing: your own module's
resources come before the starter's jar, so a file you place at the same resource path is
the one found.

```
src/main/resources/META-INF/peekaboot/ui/assets/tokens.css
```

This **replaces the file wholesale**, not just the properties you name &mdash; there's no
partial-override or cascade mechanism at play, since the toolbar and overlay fetch this
exact URL into an isolated shadow root rather than inheriting page-level CSS. Start from a
copy of the shipped file (linked below) and change only the values you need; every custom
property the dashboard, toolbar or overlay reference has to still be present in your
version, or that property resolves to nothing wherever it's used.

## Worked override

Say you want the fill colour to be your own brand blue instead of Peekaboot's green, in
both light and dark mode. Copy `tokens.css` in full, then change just the primary trio in
each of its two blocks:

```css
/* :root, :host block (light) */
--pk-primary: #2563eb;       /* was #66b327 */
--pk-primary-text: #1d4ed8;  /* was #447718 - recheck contrast against --pk-bg/--pk-bg-alt */
--pk-on-primary: #ffffff;    /* was #0d1117 - recheck contrast against the new --pk-primary */

/* [data-theme="dark"], :host([data-theme="dark"]) block */
--pk-primary: #60a5fa;       /* was #84cf3d */
--pk-primary-text: #60a5fa;  /* was #84cf3d */
--pk-on-primary: #0d1117;    /* was #0d1117 - recheck: dark ink only works if the fill is light enough */
```

`tokens.css` documents the contrast ratio behind every value it ships (as a trailing
comment, e.g. `/* 7.25:1 on --pk-primary */`); check yours the same way with a contrast
checker before shipping &mdash; the pairing rule below is about *which* token pairs with
*which*, not a guarantee that any two colours you pick will clear AA on their own.

## Light and dark mode

Theme selection is `[data-theme="dark"]` (an attribute set on `<html>` for the dashboard
document, and on the shadow host element for the toolbar and overlay) layered over the
bare `:root`/`:host` block, which is the light theme. Every surface resolves the active
theme the same way &mdash; the stored preference if there is one, otherwise
`prefers-color-scheme` &mdash; and watches it for changes.

Only the dashboard's own toggle writes the preference, to `localStorage['peekaboot-theme']`
(`'light'` or `'dark'`). Because the dashboard, the toolbar, and the overlay are all served
same-origin, they share that storage: the toolbar and overlay each watch it (a `storage`
event listener plus a `prefers-color-scheme` media-query listener) and re-apply
`data-theme` when it changes, without any explicit wiring between the three. Flipping the
theme on the dashboard is picked up by the toolbar and overlay on their next paint,
including in an already-open tab.

## The pairing rule

Getting this wrong is the single easiest way to ship an accessibility regression by
overriding only half a pair. `tokens.css` splits its palette into two roles per colour,
and they are not interchangeable:

| Role | Tokens | Where it's used |
|---|---|---|
| **Fill** | `--pk-primary`, `--pk-warning`, `--pk-info` (and `--pk-success`, `--pk-danger`, `--pk-danger-soft`, `--pk-purple`) | Backgrounds &mdash; badge fills, buttons, banners. Each fill token is paired with an `--pk-on-*` ink token (`--pk-on-primary`, `--pk-on-warning`, `--pk-on-info`, `--pk-on-purple`, ...) drawn on top of it. |
| **Text** | `--pk-primary-text`, `--pk-warning-text`, `--pk-info-text`, `--pk-success-text` | Anything drawn directly on the page background (`--pk-bg`/`--pk-bg-alt`) &mdash; links, focus rings, borders, the selected-tab underline. |

In light mode four fills are deep enough to carry white ink &mdash; `--pk-warning`
(`#b35900`), `--pk-danger`, `--pk-info` and `--pk-purple`, each paired with
`--pk-on-*: #ffffff`. The rest take dark ink. `--pk-warning-text`, the on-background
variant, is a separate value and unaffected; so is the whole dark theme, where the pairings
invert.

The two are tuned for different grounds and are not swappable: in light mode, Peekaboot's
own brand green is a mid-lightness fill colour &mdash; white on it is only 2.6:1, well
under AA &mdash; which is exactly why `--pk-primary-text` exists as a separate, darker
green tuned to clear AA on the page background instead. Override `--pk-primary` alone,
without touching `--pk-primary-text` and `--pk-on-primary` to match, and every fill using
your new colour keeps the *old* ink token on top of it (frequently unreadable against an
unrelated colour) while every text usage keeps rendering in the *old* colour instead of
your new one.

<div class="pk-callout pk-callout--warning" markdown="1">
When you change a brand colour, change its whole trio together: the fill token, its
`--pk-on-*` ink, and its `-text` variant. Changing only the fill token is the accessibility
regression waiting to ship &mdash; it looks correct wherever that colour is used as a
background, and silently wrong (or silently unreadable) everywhere it's used as text.
</div>

## Three tokens worth naming

Most tokens explain themselves from the file. These three do not, and a copy of
`tokens.css` that predates them loses the theming for their rules:

| Token | What it paints |
|---|---|
| `--pk-mark-bg` / `--pk-on-mark` | The search highlight's fill and ink. A `<mark>` needs both or it is unreadable, not merely un-themed. |
| `--pk-danger-tint` | The error banner's wash &mdash; each theme's own `--pk-danger` at 4% alpha. |

Every rule reading one carries the light-theme literal as its `var()` fallback, so an older
copy costs the dark palette for that rule and nothing else.

## `color-scheme` and the type scale

Both theme blocks declare `color-scheme` (`light` and `dark`), so native widgets &mdash;
scrollbars, the `<select>` popup, checkboxes, the caret &mdash; follow the theme instead of
staying light on a dark page. Keep it if you copy the file.

The type scale is declared twice on purpose. `--pk-text-xs` through `--pk-text-lg` are
`rem` in the shared `:root, :host` block, then re-declared as the equivalent **px** values
in a `:host`-only block below it. The toolbar and the overlay live inside pages Peekaboot
does not own, where `rem` follows the host's root font size &mdash; an
`html { font-size: 62.5% }` reset would shrink the bar to 7.5px &mdash; while the
dashboard's own document keeps honouring a reader's root-size preference. Overriding
`--pk-text-*` for the dashboard therefore means overriding the `:host` block too, or the
toolbar and overlay keep the px values.

## The full token list

`tokens.css` defines the complete set &mdash; colour, spacing, typography and radius
tokens, plus the exact contrast ratio behind every colour pairing, as inline comments.
Rather than reproduce all of it here, read it directly:
[`tokens.css`]({{ site.repository_url }}/blob/HEAD/peekaboot-frontend/src/main/resources/META-INF/peekaboot/ui/assets/tokens.css).
