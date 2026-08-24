---
title: Dev toolbar
lead: A collapsed bar on every HTML response, one click away from the full trace.
permalink: /docs/dev-toolbar/
---

The dev toolbar defaults on for a local run, off elsewhere &mdash; the same launch-context
detection as `peekaboot.enabled` itself, computed independently of it, so turning
Peekaboot on deliberately in a shared environment doesn't also inject the toolbar there.
See [How activation works]({{ '/docs/how-activation-works/' | relative_url }}) for exactly
what counts as local. Set it explicitly either direction to override the detection:

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
the bar fetches `/peekaboot/api/traces/{traceId}/insights` on a fixed four-attempt
schedule &mdash; 250ms, 500ms, 1s and 3s after the previous attempt, the last landing
around 4.75s after the response the bar is reporting on arrived &mdash; and re-renders on
each response that carries a trace. All four attempts always run, rather than stopping the
first time the trace looks complete, so a span that ends after the root span (an `@Async`
continuation, a streamed body) still reaches the bar. Peekaboot's own 200ms span export
delay when the toolbar is on (see [Auto-configured
defaults]({{ '/docs/auto-configured-defaults/' | relative_url }})) means a trace is
normally there well before the last attempt.

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

<div class="pk-callout" markdown="1">
**The Queries tab shows real SQL text as long as your JDBC instrumentation tags spans with
one of four recognized patterns**, checked in this order by `QueryExtractor.findSql`:
`db.query.text` (OpenTelemetry's current semantic convention, emitted by
`datasource-micrometer-opentelemetry` &mdash; the OpenTelemetry-native stack
`peekaboot-testing-app` itself uses), then `db.statement` (the same convention's
superseded spelling), then `jdbc.query[N]` (`datasource-proxy`/Micrometer). Only if none
of those tags are present does the tab fall back to the span's own name, and only when
that name itself already looks like SQL (starts with `SELECT `, `INSERT `, `UPDATE ` or
`DELETE `). This is about the Queries tab specifically: the Spans tab shows a span's own
name regardless &mdash; OpenTelemetry's own summary form (e.g. `SELECT customer_order`),
which is correct there, not a fallback.
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
