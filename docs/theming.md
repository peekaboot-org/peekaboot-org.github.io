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
nothing else to override for colour: component styles and layout in `base.css` and
`components.css` never hardcode a colour outside of these tokens.

## How to override it

Peekaboot serves `tokens.css` as a static resource, registered at `/peekaboot/ui/**` from
`classpath:/static/peekaboot/ui/` with caching disabled. The standard Spring Boot way to
override a starter-provided static resource applies here too: place a file at the
identical path under your own application's static resources, and it's served in place of
the one bundled in the starter jar.

```
src/main/resources/static/peekaboot/ui/assets/tokens.css
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
--pk-primary-text: #1d4ed8;  /* was #487e1b - recheck contrast against --pk-bg/--pk-bg-alt */
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
bare `:root`/`:host` block, which is the light theme. `shared/theme.js` resolves the
active theme once &mdash; the stored preference if there is one, otherwise
`prefers-color-scheme` &mdash; and every surface applies and watches it the same way.

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
| **Fill** | `--pk-primary`, `--pk-warning`, `--pk-info` (and `--pk-success`, `--pk-danger`, `--pk-danger-soft`) | Backgrounds &mdash; badge fills, buttons, banners. Each fill token is paired with an `--pk-on-*` ink token (`--pk-on-primary`, `--pk-on-warning`, `--pk-on-info`, ...) drawn on top of it. |
| **Text** | `--pk-primary-text`, `--pk-warning-text`, `--pk-info-text`, `--pk-success-text` | Anything drawn directly on the page background (`--pk-bg`/`--pk-bg-alt`) &mdash; links, focus rings, borders, the selected-tab underline. |

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

## The full token list

`tokens.css` defines the complete set &mdash; colour, spacing, typography and radius
tokens, plus the exact contrast ratio behind every colour pairing, as inline comments.
Rather than reproduce all of it here, read it directly:
[`tokens.css`]({{ site.repository_url }}/blob/HEAD/peekaboot-frontend/src/main/resources/static/peekaboot/ui/assets/tokens.css).
