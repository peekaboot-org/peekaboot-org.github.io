# peekaboot.org

Source for the [Peekaboot](https://github.com/peekaboot-org/peekaboot) documentation site,
built with Jekyll and published via GitHub Pages.

GitHub Pages builds this repository natively: push to `main` and Pages runs its own pinned
Jekyll toolchain against it directly. There is no GitHub Actions workflow and no Node
tooling anywhere in the pipeline. `Gemfile` exists only to mirror that toolchain for local
preview, and is excluded from the built site (see `exclude:` in `_config.yml`).

## The custom domain

`CNAME` claims `www.peekaboot.org`, which is what `<url>` in the published poms and the
dashboard's footer link both point at. That host serves the site today, from Cloudflare's
edge in front of Pages under a Cloudflare-issued certificate. The zone is **proxied**, not
DNS-only. The apex resolves to nothing, so only `www` works.

Records on the Cloudflare account holding `peekaboot.org`:

- `www` → `CNAME` → `peekaboot-org.github.io`. In place.
- the apex, if it should redirect too → `A` records to `185.199.108.153`,
  `185.199.109.153`, `185.199.110.153`, `185.199.111.153`, and `AAAA` to
  `2606:50c0:8000::153` through `2606:50c0:8003::153`. Not in place.

GitHub's guidance is to set these DNS-only, because a proxy in front of an unvalidated
domain stops Pages issuing its own certificate. The live setup takes the other route and
lets Cloudflare terminate TLS instead, which works. Switching to DNS-only later means
waiting for the Pages certificate before enforcing HTTPS.

## Local preview

Run `./serve.sh`. It builds the site and serves it at <http://localhost:4000>, rebuilding
and reloading the browser as you edit:

```bash
./serve.sh              # build, serve, watch for edits
./serve.sh --build      # build into _site/ and exit
PORT=8080 ./serve.sh    # serve somewhere else
```

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

## Structure

- `_config.yml`: site settings. `theme: null` is required to disable GitHub Pages' implicit
  default theme (`jekyll-theme-primer`), which otherwise ships its own unused CSS alongside
  ours.
- `_data/nav.yml`: the documentation sidebar, grouped into sections.
- `_layouts/default.html`, `home.html`, `doc.html`: page shells. `doc.html` renders the
  sidebar and a page's `title`/`lead` front matter.
- `assets/peekaboot.css`: the brand mapping over vendored Bulma 1.0.4
  (`assets/bulma.min.css`).
- `assets/site.js`: theme resolution (shared `peekaboot-theme` localStorage key and
  `data-theme` attribute with Peekaboot's own dashboard) and the navbar burger. Loaded
  synchronously in `<head>`, without `defer`, so the theme applies before first paint.

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
`docs/traces.md` and `docs/configuration.md` each carry two.

## Decisions taken deliberately

- **Links into the product repo use `/blob/HEAD/`, never a branch name.** `HEAD` follows
  whatever the default branch is and survives a rename.
- **`theme: null` stays.** Without it GitHub Pages ships `jekyll-theme-primer`'s unused CSS
  on every deploy.
- **Bulma is vendored, not CDN-linked.** `assets/bulma.min.css` is a committed copy of
  1.0.4: no third-party request, works offline.
- **The brand mapping is three numbers.** `--bulma-primary-h/s/l` is the mark's own green.
  That green is fill-tuned (white on it is 2.6:1), so link and body text use `--pk-link`,
  never `--bulma-primary`. It is the same fill/text split the product's `tokens.css` makes.
- **The site's dark background is Bulma's, not the dashboard's.** `#14161a` against the
  dashboard's `#0d1117`. Closing that gap would re-tune every grey Bulma derives in dark
  mode for a difference nobody can see side by side.
- **The theme toggle shares the product's storage key** (`peekaboot-theme`) and its
  `data-theme` attribute. `assets/site.js` loads synchronously in `<head>` so the theme
  applies before first paint. Do not add `defer`.
- **Honest limits are stated on purpose.** Masking is not exhaustive and has no entropy
  detection. `show-values: always` on a local run widens the host's own actuator endpoints.
  Peekaboot has no authentication of its own, sees one process, captures log content
  unmasked, and its insights percentiles are percentiles of aggregates rather than real
  percentiles. Every one of those caveats is load-bearing. Tighten the wording if you like;
  do not turn any of them into a promise.

## If you change the product, check these pages

| Change | Pages to revisit |
| --- | --- |
| Any masking rule | `docs/security.md`, `docs/configuration.md` |
| A new or renamed property, or one of Peekaboot's defaults | `docs/configuration.md`, `docs/in-production.md` |
| Activation conditions | `docs/configuration.md` (*When Peekaboot is on*), `docs/in-production.md`, `docs/quick-start.md`, `docs/security.md` |
| An API endpoint or parameter | `docs/api.md` |
| Trace capture or the span cap | `docs/traces.md`, `docs/troubleshooting.md` |
| Root action type detection | `docs/traces.md` |
| A dashboard tab, or a header control | `docs/dashboard.md`, and re-run the screenshots |
| A dashboard tab *rename* | also `docs/troubleshooting.md`, `docs/quick-start.md`, and `docs/api.md` (the `/api/features` flag behind Meters is `metrics`) |
| `peekaboot-insights-defaults.yml`, or the panel-file schema | `docs/insights.md`, which states the field sets and the 16/6/39 counts |
| An insights level default, or the memory formula | `docs/insights.md`, `docs/configuration.md`, both of which carry worked arithmetic |
| The startup summary's lines, or how a URL in it is built | `docs/configuration.md` (*The URLs in the summary*) |
| Anything under `peekaboot.storage`, or what the two stores write | `docs/configuration.md`, `docs/security.md`, `docs/insights.md` |
| The runs projection, its columns or its badges | `docs/dashboard.md` (*Lifecycle*) |

`tokens.css` is not on that list. This site does not document theming; the product repo's
`peekaboot-frontend/README.md` owns the token set.

## Screenshots

The screenshots under `assets/img/screenshots/` come from the product repo's Playwright
tool, not from this repo. Run it from `peekaboot-testing-app`:

```bash
mvn -pl peekaboot-testing-app test \
    -Dtest=ScreenshotCapture \
    -Dpeekaboot.screenshots.out=/absolute/output/dir
```

It needs Docker running. The capture runs under the `screenshots` Spring profile, which
starts real PostgreSQL via `spring-boot-docker-compose` and runs Flyway against it, so every
dashboard tab (Flyway history, queries, traces) has genuine content instead of an empty
state.

The tool's file names are canonical: `dashboard-<tab id>-<theme>.png` for the dashboard
tabs, plus the revealed, trace-detail and toolbar shots (the product repo's
`peekaboot-testing-app/README.md` lists them all). This repo uses those names verbatim in
`assets/img/screenshots/` and in every `<img>` reference. When a tab id changes in the
product, the files and references here are renamed to follow.

## Measured contrast

Body text and link text, measured in a real browser (Chromium via Playwright) against their
actual computed backgrounds, walking up to the nearest ancestor with a non-transparent
background rather than reading off the CSS source, using the standard WCAG
relative-luminance formula. All four clear the 4.5:1 AA threshold for normal text by a wide
margin:

| Theme | Body text (`.pk-content p`) | Link text (`.pk-content a`) |
| --- | --- | --- |
| Light | 9.45:1 | 4.91:1 |
| Dark | 8.43:1 | 9.46:1 |

Measured on `/docs/quick-start/`; the CSS is site-wide, so these figures hold for every doc
page. If a future palette or token change moves these numbers, re-measure and update this
table rather than trusting the CSS comments alone. `assets/peekaboot.css` documents the
light/dark link ratios inline, but the body-text figures above only come from the browser.

## Remaining manual setup

Everything in this repo is ready. What is left happens outside it:

1. In the repo's Settings → Pages, **Source** must be *Deploy from a branch*, branch
   `main`, folder `/ (root)`. There is no Actions workflow to fall back on.
2. The `www` host is live. The apex is not: see [The custom domain](#the-custom-domain) for
   the records it would need, and enable **Enforce HTTPS** once a certificate covers
   whatever the final arrangement is.

## A note on product-repo links

Pages throughout `docs/` link into the product repo with `blob/HEAD/...` (e.g.
`{{ site.repository_url }}/blob/HEAD/...`), so they always resolve against whatever
`origin/HEAD` currently is, never a pinned commit.

## License

Apache License 2.0. See [LICENSE](LICENSE).
