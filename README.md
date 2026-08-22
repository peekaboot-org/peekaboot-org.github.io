# peekaboot.org

Source for the [Peekaboot](https://github.com/peekaboot-org/peekaboot) documentation site,
built with Jekyll and published via GitHub Pages.

## Local preview

GitHub Pages builds this site with its own pinned toolchain (the `github-pages` gem), which
`Gemfile` mirrors for local preview. Building locally with a plain `jekyll` install can drift
from what Pages actually renders, so preview with Docker instead:

```bash
docker run --rm -v "$PWD":/srv/jekyll -w /srv/jekyll ruby:3.3 \
  sh -c 'gem install bundler --no-document >/dev/null && bundle install --quiet && bundle exec jekyll build --trace'
```

`ruby:3.3` is confirmed working — the `github-pages` gem resolves and builds cleanly on it.
If a future `github-pages` release stops resolving on Ruby 3.3, fall back to `ruby:3.1`, which
is closer to what Pages itself runs.

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

Every page under `docs/` needs an explicit `permalink` front matter entry matching its
`_data/nav.yml` URL exactly (e.g. `permalink: /docs/quick-start/`). Without it Jekyll renders
`/docs/quick-start.html` instead, and the sidebar's current-page highlight never activates.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
