---
title: Dev toolbar
lead: A collapsed bar on every HTML response, one click away from the full trace.
permalink: /docs/dev-toolbar/
---

The dev toolbar is opt-in. Enable it with:

```yaml
peekaboot:
  dev-toolbar: true
```

It also needs a Micrometer `Tracer` bean, which the starter provides by default &mdash;
see [Requirements]({{ '/docs/requirements/' | relative_url }}) for what happens without
one.

## What gets injected, and into what

A servlet filter buffers each response and, right before its closing `</body>` tag,
inserts a small bootstrap: a JSON blob describing the request, and a `<script
type="module">` that loads the toolbar's own code. Injection only happens for responses
whose content type is `text/html` and that actually contain a `</body>` tag; static
assets (`.css`, `.js`, images, fonts), `/actuator/**`, `/peekaboot/**`, `/webjars/**`, and
AJAX requests (`X-Requested-With: XMLHttpRequest`) are skipped outright. If anything goes
wrong while generating or injecting the toolbar, the original response goes out
unmodified rather than a broken page.

Swagger UI is a special case: its own HTML never carries the request that matters, so the
toolbar loads in an idle mode there and picks up trace ids from your API calls instead
&mdash; see below.

## Collapsed bar

<figure class="image">
  <img src="{{ '/assets/img/screenshots/toolbar-collapsed-light.png' | relative_url }}"
       alt="The collapsed dev toolbar docked at the bottom of the page, showing a 200 status badge, GET /orders, the controller method, duration, query count and duration, and a copyable trace id"
       loading="lazy">
</figure>

Docked to the bottom of the page, it shows the response status (colour-coded), method and
path, the resolved controller method, request duration, database query count and total
query time, and the trace id (labelled and copyable). The metrics arrive asynchronously:
the bar polls `/peekaboot/api/traces/{traceId}/insights` with exponential backoff until
the trace is complete, since the response you're looking at can finish rendering before
its trace has fully assembled.

Clicking anywhere on the bar &mdash; other than the trace id or the dashboard link, which
have their own targets &mdash; opens the full trace detail overlay for that request.

## Expanded overlay

<figure class="image">
  <img src="{{ '/assets/img/screenshots/trace-detail-light.png' | relative_url }}"
       alt="The expanded trace detail overlay for a GET /orders request, showing a span tree with nested CLIENT and SERVER spans, database connection and query spans, and timing bars"
       loading="lazy">
</figure>

The overlay is the same trace-detail view the dashboard's Traces tab uses, with four
tabs: **Spans** (the full tree, each node's kind, tags and duration), **Queries** (SQL
text, duration, and row counts where the instrumentation on your classpath provides them),
**Logs** (log messages correlated to the span that emitted them), and **Request** (method,
path, headers, and the resolved controller/handler method). See
[Tracing]({{ '/docs/tracing/' | relative_url }}) for what's actually captured and how span
deduplication works, and [Concepts]({{ '/docs/concepts/' | relative_url }}) for what a
span, a root span and a trace status mean.

<div class="pk-callout pk-callout--warning" markdown="1">
**The Queries tab only shows real SQL text when your JDBC instrumentation tags spans with
`db.statement` or `jdbc.query[N]`.** A stack built on `datasource-micrometer-opentelemetry`
&mdash; the OpenTelemetry-native alternative, and what `peekaboot-testing-app` itself uses
&mdash; tags query spans with `db.query.text` instead, which Peekaboot doesn't currently
recognize; affected queries fall back to showing the span's own abbreviated name (e.g.
`SELECT person`) rather than the statement. This is a known, unfixed gap in
`QueryExtractor.findSql`.
</div>

## Shadow DOM isolation

The toolbar mounts into a shadow root (`element.attachShadow({mode: 'open'})`) attached to
a dedicated host `<div>` appended to `<body>`. Everything inside that boundary &mdash; the
toolbar's markup and its own stylesheets &mdash; is isolated in both directions: the host
page's CSS selectors can't reach in and restyle the toolbar's internals, and the
toolbar's own rules can't leak out and affect the host page. The host `<div>` itself is
still a regular node in the page's own DOM, positioned with an inline style
(`position:fixed; bottom:0`); an unusually aggressive host stylesheet targeting that
element directly could still affect its outer box, but nothing about the toolbar's own
appearance depends on the host page's styles or is reachable from them.

## Idle mode (Swagger UI)

On Swagger UI's own page, the toolbar has no request of its own to report on, so it loads
idle and patches `window.fetch`: every response from the app's own API is inspected for a
`Server-Timing` header, and the trace id embedded in it is used to load that trace into
the bar &mdash; see [Tracing]({{ '/docs/tracing/' | relative_url }}) for the header's
exact format. Calls to Peekaboot's own paths, Swagger's own paths, and `/actuator/**` are
excluded from that interception.
