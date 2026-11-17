# peekaboot.org

Source for the [Peekaboot](https://github.com/peekaboot-org/peekaboot) documentation site,
built with Jekyll and published via GitHub Pages.

## Local preview

Run `./serve.sh`. It builds the site and serves it at <http://localhost:4000>, rebuilding
and reloading the browser as you edit:

```bash
./serve.sh              # build, serve, watch for edits
./serve.sh --build      # build into _site/ and exit
PORT=8080 ./serve.sh    # serve somewhere else
BIND=0.0.0.0 ./serve.sh # let other machines reach the preview
```

The preview answers this machine only, unless `BIND` names another address to publish it on.

Everything runs in Docker, so no Ruby, Bundler or Node is needed on your machine. Docker
does have to be running. The first run takes a minute installing gems into `vendor/bundle`
(gitignored); later runs start in seconds.

The script deliberately builds with the **`github-pages` gem**, the same pinned toolchain
Pages itself uses, so what you see locally is what Pages will publish. A plain `jekyll`
install can drift from that. It pins `ruby:3.3`, which is confirmed to resolve the gem; if a
future `github-pages` release stops working there, fall back to `ruby:3.1`, closer to what
Pages runs.

Two things you may notice, neither a problem:

- A `faraday-retry` notice on stderr, from `jekyll-github-metadata`'s Faraday dependency,
  emitted purely by loading the gem. No live GitHub API call is ever made during the build.
- The container runs as your own user, so nothing it writes is root-owned. If an earlier raw
  `docker run` left root-owned files behind, the script detects and repairs that on startup
  rather than failing with a permission error you can't clear without `sudo`.

## Checks

The checks under `test/` read the built site, so build it first:

```bash
./serve.sh --build
cd test && npm ci && npm test
```

A `./serve.sh` run leaves a development build in `_site`, whose sitemap names the preview's
address, so build again before the checks.

They need Node. They were written on Node 24, and `playwright-core` asks for 20 or later.
The checks that open a page drive the Chromium revision of `playwright-core` 1.63.0. If one
reports a missing browser, run `npx playwright-core install chromium` in `test/` once.

The `playwright-core` version follows `playwright.version` in the product's
`peekaboot-testing-app/pom.xml`, so both repos drive the same Chromium revision.

Nothing runs the checks in CI, because Pages builds from the branch and this repo has no
workflow. Run them before you push.

## Structure

- `_config.yml`: site settings. `theme: null` is required to disable GitHub Pages' implicit
  default theme (`jekyll-theme-primer`), which otherwise ships its own unused CSS alongside
  ours. The product repo's release job overwrites `peekaboot_version` on every release, so
  it is not edited by hand.
- `_data/releases.json`: the entries of the releases page. The same job overwrites the file
  on every release, so it is not edited by hand either.
- `_data/nav.yml`: the documentation sidebar, grouped into sections, and the navbar. An
  entry with a `navbar:` label also appears in the navbar; a section with one links to its
  first page.
- `_includes/facts/`: explanations that more than one page needs. Each is written once here
  and included where it is needed. `test/build.test.mjs` lists them in `FACTS`. A fragment
  ends with a newline. Close the tag with `-%}` where the next line continues the same
  paragraph or list.
- `_layouts/default.html`, `page.html`, `doc.html`: page shells. `page.html` wraps a page
  that lays itself out, as `index.html` and `releases.html` do. `doc.html` renders the
  sidebar and a page's `title`/`lead` front matter, and wraps each Markdown table in a
  `.pk-table-scroll` box. It matches the bare `<table>` kramdown writes, so a table given
  attributes fails the `tables keep their semantics` check.
- `assets/peekaboot.css`: the brand mapping over vendored Bulma
  (`assets/bulma.min.css`, whose banner names the version).
- `assets/img/logo-mark-dark-480.png`: the landing page's logo on the dark theme. It is
  `peekaboot-logo-mark-dark.png` from the sibling `assets/` directory (see "Social images"),
  scaled with `magick <source> -resize 480x480 -strip <target>`.
- `assets/site.js`: theme resolution, the navbar burger, the toggle that opens the docs
  sidebar on a phone, the `#` anchor on each doc heading, and the tab stop on a table too
  wide for its box. Loaded synchronously in `<head>`, without `defer`, so the theme applies
  before first paint. The theme's storage key and attribute carry the product's names by
  convention only, see "Decisions taken deliberately".
- `test/`: the checks, see "Checks". `_config.yml` keeps the folder out of the published
  site.

## Adding a page

1. Add a Markdown file under `docs/` with front matter that includes an explicit
   `permalink`, matching the URL you intend to link to, e.g.:

   ```yaml
   ---
   title: My new page
   lead: One sentence describing it.
   permalink: /docs/my-new-page/
   ---
   ```

2. Add a matching entry (`title` + `url`) to `_data/nav.yml`, under the appropriate section.

**Omitting `permalink` silently breaks the sidebar.** Without it, Jekyll derives the page's
URL from its path (`/docs/my-new-page.html` instead of `/docs/my-new-page/`). The page still
builds and still loads, but its URL never equals the `url` in `_data/nav.yml`, so the
sidebar's current-page highlight (`aria-current="page"`, driven by `page.url == item.url` in
`_includes/sidebar.html`) never activates on it, with no build error to flag the mistake.

When a page is merged into another, keep its old URL alive with `redirect_from` in the
surviving page's front matter (`jekyll-redirect-from` is enabled in `_config.yml`).

## Decisions taken deliberately

- **Links into the product repo and the skills repo use `/blob/HEAD/`, never a branch
  name.** Pages write them as `{{ site.repository_url }}/blob/HEAD/...` and
  `https://github.com/peekaboot-org/peekaboot-skills/blob/HEAD/...`, so they resolve against
  whatever `origin/HEAD` currently is, never a pinned commit and never a branch name that
  could be renamed.
- **`theme: null` stays.** Without it GitHub Pages ships `jekyll-theme-primer`'s unused CSS
  on every deploy.
- **Bulma is vendored, not CDN-linked.** `assets/bulma.min.css` is a committed copy: no
  third-party request, works offline.
- **Bulma ships whole.** `assets/bulma.min.css` is the complete build, 677,931 bytes by
  `wc -c`. A cut-down build needs a Sass toolchain, which the site does not have.
- **The brand mapping is three numbers.** `--bulma-primary-h/s/l` is the mark's own green.
  That green is fill-tuned (white on it is 2.6:1), so link and body text use `--pk-link`,
  never `--bulma-primary`. It is the same fill/text split the product's `tokens.css` makes.
- **The site's dark background is Bulma's, not the dashboard's.** `#14161a` against the
  dashboard's `#0d1117`. Closing that gap would re-tune every grey Bulma derives in dark
  mode for a difference nobody can see side by side.
- **The theme toggle uses the product's names by convention.** The storage key
  (`peekaboot-theme`) and the `data-theme` attribute are named as the dashboard names them.
  `localStorage` is per origin, so a theme chosen in a dashboard never reaches the site.
  `assets/site.js` loads synchronously in `<head>` so the theme applies before first paint.
  Do not add `defer`.
- **Honest limits are stated on purpose.** Masking is not exhaustive and has no entropy
  detection. Peekaboot's dashboard guard is one HTTP Basic credential with no throttle on
  failed attempts. It sees one process, masks log content by value shape only, and its
  insights percentiles are percentiles of aggregates rather than real percentiles. Every one of those
  caveats is load-bearing. Tighten the wording if you like; do not turn any of them into a
  promise.

## If you change the product, check these pages

| Change | Pages to revisit |
| --- | --- |
| Any masking rule | `docs/security.md` |
| A new or renamed property, or one of Peekaboot's defaults | `docs/configuration.md`, `docs/in-production.md` |
| Activation conditions | `docs/configuration.md` (*When Peekaboot is on*), `docs/in-production.md`, `docs/quick-start.md`, `docs/security.md` |
| An API endpoint or parameter | `docs/api.md`, `docs/agents.md`, `llms.txt`, `_includes/facts/guard-refusal.md`, `_includes/facts/insights-stream-cap.md` |
| The guard's credentials, or what the API index lists | `_includes/facts/guard-credentials.md`, `docs/agents.md`, `llms.txt` |
| Trace capture or the span cap | `docs/traces.md`, `docs/troubleshooting.md`, `_includes/facts/trace-memory.md`, `_includes/facts/propagate-context.md` |
| Root action type detection | `docs/traces.md` |
| A dashboard tab, or a header control | `docs/dashboard.md`, and re-run the screenshots |
| The screenshot size | `_includes/screenshot.html`, which declares 1440 by 900 for every shot |
| A dashboard tab *rename* | also `docs/troubleshooting.md`, `docs/quick-start.md`, and `docs/api.md` (the `/api/features` flag behind Meters is `metrics`) |
| `peekaboot-insights-defaults.yml`, or the panel-file schema | `docs/insights.md`, which states the field sets and tabulates the shipped panels |
| An insights level default, or the memory per series | `_includes/facts/insights-memory.md`, which carries the default figures, `docs/insights.md`, and `docs/configuration.md`, which works an example |
| The startup summary's lines, or how a URL in it is built | `docs/configuration.md` (*The URLs in the summary*) |
| Anything under `peekaboot.storage`, or what the stores write | `_includes/facts/storage-files.md`, `_includes/facts/local-run-disk.md`, `docs/configuration.md`, `docs/security.md`, `docs/insights.md`, `docs/traces.md` |
| The runs projection, its columns or its badges | `docs/dashboard.md` (*Lifecycle*) |
| The error page, its back-off rules or the override | `docs/error-page.md`, `_includes/facts/error-page-accept.md` |

`tokens.css` is not on that list. This site does not document theming; the product repo's
`peekaboot-frontend/README.md` owns the token set.

## Screenshots

The screenshots under `assets/img/screenshots/` come from the product repo's Playwright
tool, not from this repo. Run it from `peekaboot-testing-app`:

```bash
mvn -pl peekaboot-testing-app -am test \
    -Dtest=ScreenshotCapture \
    -Dsurefire.failIfNoSpecifiedTests=false \
    -Dpeekaboot.screenshots.out=/absolute/output/dir
```

Without `-am` the other reactor modules come from the local repository, which may hold an
older install, and the tool then photographs that code. `-Dtest` applies to every module
`-am` pulls in, and only one has the class, hence the second flag.

It needs Docker running. The capture runs under the `screenshots` Spring profile, which
starts real PostgreSQL and MySQL via `spring-boot-docker-compose` and runs Flyway and
Liquibase against them, so every dashboard tab (Flyway and Liquibase history, queries,
traces) has genuine content instead of an empty state.

The tool's file names are canonical: `dashboard-<tab id>-<theme>.png` for the dashboard
tabs, plus the revealed, trace-detail and toolbar shots (the product repo's
`peekaboot-testing-app/README.md` lists them all). This repo uses those names verbatim in
`assets/img/screenshots/` and as the keys of `_data/screenshots.yml`, which holds each shot's
alt text. A page shows a shot with `{% include screenshot.html name="dashboard-overview" %}`,
plus an optional `caption`, or an `alt` where the page describes the shot differently on
purpose. When a tab id changes in the product, the files and keys here are renamed to follow.

## Social images

`assets/img/social/` and the three app icons in `assets/img/` are generated, not drawn.
The generator lives beside the logo artwork in the sibling `assets/` directory, which is
not a git checkout:

```bash
cd ../assets
pip install Pillow playwright && playwright install chromium
python3 generate_social.py && python3 verify_social.py
```

`generate_social.py` derives everything from `peekaboot-logo-favicon.png`. The mark is a
two-colour blend of `#66b327` and `#263238`, so it recolours for dark surfaces by lifting
the ink to `#e6edf3`, the same swap `logo-mark-dark.png` already makes, applied at full
resolution. The cards themselves are laid out in `social_card.html` in the dark-theme
tokens from `tokens.css` and screenshotted by headless Chromium at the exact target size;
`verify_social.py` then checks every output's dimensions, background and alpha.

| File | Size | Where it goes |
| --- | --- | --- |
| `social/og.png` | 1200×630 | `og:image`, read by X, LinkedIn, Facebook, Slack, Discord, Mastodon and Bluesky |
| `social/github-social-preview.png` | 1280×640 | GitHub repo and org *Settings → Social preview* |
| `social/x-header.png` | 1500×500 | X profile banner |
| `social/linkedin-cover.png` | 1128×191 | LinkedIn page cover |
| `social/avatar-512.png` | 512×512 | Avatar for light chrome; transparent |
| `social/avatar-512-dark.png` | 512×512 | Avatar for dark chrome: GitHub dark, Discord, Mastodon |
| `apple-touch-icon.png` | 180×180 | `rel="apple-touch-icon"`; opaque, since iOS composites it |
| `icon-192.png`, `icon-512.png` | 192, 512 | `rel="icon"` |

Only `og.png` and the three app icons are referenced by the site; the rest are uploaded
through each platform's own settings and live here to keep them under version control.

## Measured contrast

`test/measure-contrast.mjs` prints this table. It opens `/docs/quick-start/` in Chromium, in
the light and the dark theme, and measures each text colour against its ground with the WCAG
relative-luminance formula. The ground is the nearest opaque background on the element or an
ancestor, read from the computed styles.

| Text | Light | Dark |
| --- | --- | --- |
| Body text (`.pk-content p`) | 9.45:1 | 8.43:1 |
| Link on the page ground (`.pk-content > p a`) | 5.39:1 | 9.46:1 |
| Link on the tinted ground of a callout (`.pk-callout a`) | 4.90:1 | 8.32:1 |
| Current sidebar entry, on the tinted ground (`.pk-sidebar__link.is-current`) | 4.90:1 | 8.32:1 |

The link colour is measured on both grounds because the tinted one leaves it less contrast.
Every figure clears the 4.5:1 that AA asks of normal text. The table records one page. The
`text clears AA contrast` checks in `test/theme.test.mjs` hold the threshold on every page.

After a palette or token change, measure again and paste the output here:

```bash
./serve.sh --build
cd test && node measure-contrast.mjs
```

The comments in `assets/peekaboot.css` state the link ratios too, so change them with the
table.

## Remaining manual setup

Everything in this repo is ready. What is left happens outside it:

1. In the repo's Settings → Pages, **Source** must be *Deploy from a branch*, branch
   `main`, folder `/ (root)`. There is no Actions workflow to fall back on.
2. The `www` host is live, served through Cloudflare in front of Pages. The apex
   `peekaboot.org` answers `301` to the `www` host. Enable **Enforce HTTPS** once a
   certificate covers whatever the final arrangement is.

## License

Apache License 2.0. See [LICENSE](LICENSE).
