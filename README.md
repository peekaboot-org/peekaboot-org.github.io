# peekaboot.org

Source for the [Peekaboot](https://github.com/peekaboot-org/peekaboot) documentation site,
built with Jekyll and published via GitHub Pages.

GitHub Pages builds this repository natively: push to `main` and Pages runs its own pinned
Jekyll toolchain against it directly. There is no GitHub Actions workflow and no Node
tooling anywhere in the pipeline — `Gemfile` exists only to mirror that toolchain for local
preview, and is excluded from the built site (see `exclude:` in `_config.yml`).

## Local preview

Run `./serve.sh`. It builds the site and serves it at <http://localhost:4000>, rebuilding
and reloading the browser as you edit:

```bash
./serve.sh              # build, serve, watch for edits
./serve.sh --build      # build into _site/ and exit
PORT=8080 ./serve.sh    # serve somewhere else
```

Everything runs in Docker, so no Ruby, Bundler or Node is needed on your machine — but
Docker does have to be running. The first run takes a minute installing gems into
`vendor/bundle` (gitignored); later runs start in seconds.

The script deliberately builds with the **`github-pages` gem**, the same pinned toolchain
Pages itself uses, so what you see locally is what Pages will publish. A plain `jekyll`
install can drift from that. It pins `ruby:3.3`, which is confirmed to resolve the gem; if a
future `github-pages` release stops working there, fall back to `ruby:3.1`, closer to what
Pages runs.

Two things you may notice, neither a problem:

- A `faraday-retry` notice on stderr, from `jekyll-github-metadata`'s Faraday dependency,
  emitted purely by loading the gem. No live GitHub API call is ever made during the build.
- The container runs as your own user, so nothing it writes is root-owned. If an earlier
  raw `docker run` left root-owned files behind, the script detects and repairs that on
  startup rather than failing with a permission error you can't clear without `sudo`.

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

1. In the repo's Settings → Pages, set **Source** to *Deploy from a branch*, branch `main`,
   folder `/ (root)`.
2. For the custom domain: add a `CNAME` file (not part of this commit — create it
   separately) containing `peekaboot.org`, point the apex domain's A records at GitHub
   Pages' four addresses (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
   `185.199.111.153`) and `www` at `peekaboot-org.github.io` (CNAME record), then enable
   **Enforce HTTPS** once the certificate is issued.

## A note on product-repo links

Pages throughout `docs/` link into the product repo with `blob/HEAD/...` (e.g.
`{{ site.repository_url }}/blob/HEAD/...`), so they always resolve against whatever
`origin/HEAD` currently is — not a pinned commit.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
