---
title: Dev toolbar
lead: Request and response detail, the trace view, and logs correlated to the request &mdash; injected into the page you're already looking at.
permalink: /docs/dev-toolbar/
---

The dev toolbar is on for a [local run]({{ '/docs/configuration/' | relative_url }}#local-run)
and off elsewhere, detected independently of `peekaboot.enabled`; set it explicitly either
direction to override the detection:

```yaml
peekaboot:
  dev-toolbar: true
```

It also needs a Micrometer `Tracer` bean, which the starter provides by default &mdash;
see [Requirements]({{ '/docs/requirements/' | relative_url }}) for what happens without
one. Once it's on, a small bar docks to the bottom of every HTML page your app renders
&mdash; not static assets, not `/peekaboot/**` or the management endpoints themselves
(that exclusion follows `management.endpoints.web.base-path`, so `/actuator/**` at
Spring Boot's default), and not AJAX requests &mdash; and if anything goes wrong
generating it, the original page goes out unmodified rather than a broken one.

The bar itself is rendered by the filter, but everything it shows is fetched by a module
under `/peekaboot/**`. So if you've put Spring Security in front of those paths, a reader
outside the role gets the bar with **Peekaboot toolbar could not start &mdash; sign in,
or check that its script is allowed to load** on it instead of the request's numbers.
See [Security &mdash; the dev toolbar asks the reader to sign
in]({{ '/docs/security/' | relative_url }}#the-dev-toolbar-asks-the-reader-to-sign-in).

It mounts inside its own shadow root, isolated from your page's styles in both
directions: your CSS can't reach in and restyle it, and its own styles can't leak out and
affect your page. See [Theming]({{ '/docs/theming/' | relative_url }}) for how to
override its look via the shared `tokens.css`.

## Request and response detail

<figure class="image">
  <img src="{{ '/assets/img/screenshots/toolbar-collapsed-light.png' | relative_url }}"
       alt="The collapsed dev toolbar docked at the bottom of the page, showing a 200 status badge, GET /orders, the controller method, duration, query count and duration, and a copyable trace id"
       loading="lazy">
</figure>

The collapsed bar is the first look: response status (colour-coded), method and path, the
resolved controller method, request duration, database query count and total query time,
and the trace id, copyable with one click. Those metrics fill in asynchronously: the bar
re-fetches the trace a few times over the first five seconds, so a span that finishes
after the response already went out still gets counted, and with the toolbar's 200 ms
export delay (see [Configuration &mdash; what Peekaboot
sets]({{ '/docs/configuration/' | relative_url }}#what-peekaboot-sets-in-your-application))
the numbers are usually final on the first attempt or two.

The status pill has one tier per response family, and 4xx and 5xx are deliberately held
apart: a client error gets a soft red that recedes, a server error the full one, because
the first is the caller's mistake and the second is yours. Anything unrecognised stays
grey rather than borrowing the 5xx tier just for not being a 2xx. The bar has room for
the number alone; the overlay spells the same status out.

Click anywhere on the bar &mdash; other than the trace id or the dashboard link, which
have their own targets &mdash; or press Enter or Space while the bar has keyboard focus,
and its Request tab shows the whole exchange on one scrolling page: the request line
itself (method, path, query string, status spelled out
as `404 Not Found`, content type and duration), the resolved controller/handler method,
query and form parameters, and last the two header tables, request then response. Each
section below the request line appears only when there is something in it, except those
two header tables, which render either way &mdash; "no headers captured" is an answer,
where a section that vanished would read as a missing feature. Headers and parameters are
masked by the same engine that masks everything else Peekaboot shows: a value whose key
looks sensitive (`password`, `authorization`, `cookie`, and the like) is replaced
outright, and a handful of value-shape patterns catch a credential &mdash; a JWT, an AWS
key, a JDBC URL's embedded password &mdash; sitting under an innocuous key. There's no
reveal control here; unlike the dashboard's Environment and Config tabs, a masked header
or parameter stays masked.
See [Security &mdash; Masking]({{ '/docs/security/' | relative_url }}#masking) for the
exact rules and what they don't catch. Request and response bodies, and uploaded file
names, aren't captured yet &mdash; there's a field reserved for them, but nothing
populates it.

## The trace view

<figure class="image">
  <img src="{{ '/assets/img/screenshots/trace-detail-light.png' | relative_url }}"
       alt="The expanded trace detail overlay for a GET /orders request, showing a span tree with nested CLIENT and SERVER spans, database connection and query spans, and timing bars"
       loading="lazy">
</figure>

That same click opens the full trace &mdash; the same view the dashboard's Traces tab
uses for any request, reachable here without leaving the page you're testing. The Spans
tab, shown above, is the whole tree: every span's kind, tags and duration, nested exactly
as they nested at runtime. The Queries tab lists the SQL each of those spans ran, with
duration and, where your instrumentation provides them, row counts; a query at or above
`peekaboot.ui.tracing.slow-query-threshold-ms` (default 50ms) is labelled SLOW here
&mdash; the query threshold, not the span thresholds. Peekaboot reads the
SQL from whichever of three tags your instrumentation sets &mdash; `db.query.text`,
`db.statement` or `datasource-proxy`'s `jdbc.query[N]` &mdash; and falls back to the span's
own name only when that already looks like SQL. The tree above shows span *names*, which
is why a database span there reads `SELECT customer_order` rather than the statement
itself.

<figure class="image">
  <img src="{{ '/assets/img/screenshots/trace-detail-queries-light.png' | relative_url }}"
       alt="The Queries tab for the same GET /orders request, listing 26 PostgreSQL statements with their duration and row count, each showing the actual lower-case select ... from SQL text rather than a span name"
       loading="lazy">
</figure>

That's what Peekaboot extracts &mdash; lower-case, parameterized SQL text, one row per
statement, nothing like the span tree's title-case summary above. See
[Tracing]({{ '/docs/tracing/' | relative_url }}) for what's actually captured, and
[Concepts]({{ '/docs/concepts/' | relative_url }}) for what a span, a root span and a
trace status mean.

The tabs link into each other, in both directions: a database span's row in the tree
jumps to that statement's entry on the Queries tab, and a query &mdash; or a log line on
the Logs tab &mdash; jumps back to the span it belongs to in the tree. Each jump switches
the tab, scrolls the target into view, puts keyboard focus on it and highlights it
briefly, so you never lose your place hunting for the row you came for.

## Logs correlated to the request

Every log line your app emitted while it handled the request lands on the same overlay's
Logs tab &mdash; timestamp, level and message, tagged with the span that was active when
it was logged, filterable by text, level or span. No grep, no correlation id to copy into
another tool by hand. Log content is captured verbatim and, unlike headers and query/form
parameters, is **not masked** &mdash; a log statement that includes a secret or PII is
captured exactly as written. See [Security]({{ '/docs/security/' | relative_url }}) for
the full picture of what's exposed once the toolbar is on.

## It also works from Swagger UI

Swagger UI's own page never carries a request that matters &mdash; there's nothing to
report on until you actually call an endpoint. So on Swagger UI's pages the toolbar loads
idle, showing "Waiting for request…", and patches `window.fetch`: every response your
app's own API returns is checked for a `Server-Timing` header, and the trace id in it
loads straight into the bar, the same as if that call had been a page navigation. Execute
any operation through Swagger's "Try it out" and the bar updates in place with that
call's status, duration and query count; click it and the same trace-detail overlay
opens, Spans, Queries, Logs and Request tabs included &mdash; the same request/response
detail and correlated logs for an API call as for a page load. Calls to Peekaboot's
own paths, Swagger's own paths (`/v3/api-docs`, `/swagger-ui/`), `/webjars/`, and
`/actuator/**` are excluded from that interception.

A customised `springdoc.swagger-ui.path` is honoured: wherever you've moved that page,
the UI itself is served from a `swagger-ui/` directory next to it, and those are the
pages the toolbar treats as Swagger UI's.
