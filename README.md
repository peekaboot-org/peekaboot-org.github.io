# peekaboot.org

Source for the [Peekaboot](https://github.com/peekaboot-org/peekaboot) documentation site,
built with Jekyll and published via GitHub Pages.

GitHub Pages builds this repository natively: push to `main` and Pages runs its own pinned
Jekyll toolchain against it directly. There is no GitHub Actions workflow and no Node
tooling anywhere in the pipeline — `Gemfile` exists only to mirror that toolchain for local
preview, and is excluded from the built site (see `exclude:` in `_config.yml`).

## Local preview

Building locally with a plain `jekyll` install can drift from what Pages actually renders,
since Pages builds with its own pinned `github-pages` gem. Preview with Docker instead:

```bash
docker run --rm -v "$PWD":/srv/jekyll -w /srv/jekyll ruby:3.3 \
  sh -c 'bundle config set path vendor/bundle && bundle install --quiet && bundle exec jekyll build --trace'
```

`ruby:3.3` is confirmed working — the `github-pages` gem resolves and builds cleanly on it,
with no warnings other than a cosmetic `faraday-retry` notice from `jekyll-github-metadata`
(triggered just by loading the gem, unrelated to this site's content — never fired since the
build never calls the GitHub API). If a future `github-pages` release stops resolving on
Ruby 3.3, fall back to `ruby:3.1`, which is closer to what Pages itself runs.

Serve the built output:

```bash
python3 -m http.server 8099 --directory _site
```

## Structure

- `_config.yml` — site settings; `theme: null` is required to disable GitHub Pages' implicit
  default theme (`jekyll-theme-primer`), which otherwise ships its own unused CSS alongside
  ours.
- `_data/nav.yml` — the documentation sidebar, grouped into sections.
- `_layouts/default.html`, `home.html`, `doc.html` — page shells; `doc.html` renders the
  sidebar and a page's `title`/`lead` front matter.
- `assets/peekaboot.css` — the brand mapping over vendored Bulma 1.0.4 (`assets/bulma.min.css`).
- `assets/site.js` — theme resolution (shared `peekaboot-theme` localStorage key/`data-theme`
  attribute with Peekaboot's own dashboard) and the navbar burger. Loaded synchronously in
  `<head>`, without `defer`, so the theme applies before first paint.

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
URL from its path (`/docs/my-new-page.html` instead of `/docs/my-new-page/`), the page still
builds and still loads, but it will never equal the `url` in `_data/nav.yml` — so the
sidebar's current-page highlight (`aria-current="page"`, driven by `page.url == item.url` in
`_includes/sidebar.html`) never activates on it, with no build error to flag the mistake.

## Screenshots

The screenshots under `assets/img/screenshots/` come from the product repo's Playwright
tool, not from this repo. Run it from `peekaboot-testing-app`:

```bash
mvn -pl peekaboot-testing-app test \
    -Dtest=ScreenshotCapture \
    -Dpeekaboot.screenshots.out=/absolute/output/dir
```

It needs Docker running: the capture runs under the `screenshots` Spring profile, which
starts real PostgreSQL via `spring-boot-docker-compose` and runs Flyway against it, so every
dashboard tab (Flyway history, queries, traces) has genuine content instead of an empty
state.

## Measured contrast

Body text and link text, measured in a real browser (Chromium via Playwright) against their
actual computed backgrounds — walking up to the nearest ancestor with a non-transparent
background, not read off the CSS source — using the standard WCAG relative-luminance
formula. All four clear the 4.5:1 AA threshold for normal text by a wide margin:

| Theme | Body text (`.pk-content p`) | Link text (`.pk-content a`) |
| --- | --- | --- |
| Light | 9.45:1 | 4.91:1 |
| Dark | 8.43:1 | 9.46:1 |

Measured on `/docs/quick-start/`; the CSS is site-wide, so these figures hold for every doc
page. If a future palette or token change moves these numbers, re-measure and update this
table rather than trusting the CSS comments alone — `assets/peekaboot.css` documents the
light/dark link ratios inline, but the body-text figures above only come from the browser.

## Remaining manual setup

Everything in this repo is ready; what's left happens outside it:

1. The `peekaboot-org/peekaboot-org.github.io` repository already exists on GitHub, and
   `origin` is already configured locally — push `main`.
2. In the repo's Settings → Pages, set **Source** to *Deploy from a branch*, branch `main`,
   folder `/ (root)`.
3. For the custom domain: add a `CNAME` file (not part of this commit — create it
   separately) containing `peekaboot.org`, point the apex domain's A records at GitHub
   Pages' four addresses (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
   `185.199.111.153`) and `www` at `peekaboot-org.github.io` (CNAME record), then enable
   **Enforce HTTPS** once the certificate is issued.

## A note on product-repo links

Pages throughout `docs/` link into the product repo with `blob/HEAD/...` (e.g.
`{{ site.repository_url }}/blob/HEAD/...`), so they always resolve against whatever
`origin/HEAD` currently is — not a pinned commit. At the time of writing, the product repo's
local `dev` branch is well ahead of `origin/dev`; until `dev` is pushed, these links will
show stale source for anything changed only in the unpushed commits.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
