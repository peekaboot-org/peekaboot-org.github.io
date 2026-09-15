---
title: Dev toolbar
lead: Request detail, the trace view and correlated logs, injected into the page you're already looking at.
permalink: /docs/dev-toolbar/
---

The dev toolbar is on for a [local run]({{ '/docs/configuration/' | relative_url }}#local-run)
and off elsewhere, detected independently of `peekaboot.enabled`. Set it explicitly either
direction to override the detection:

```yaml
peekaboot:
  dev-toolbar: true
```

It also needs a Micrometer `Tracer` bean, which the starter provides by default. See
[Quick start]({{ '/docs/quick-start/' | relative_url }}) for what happens without one.

## Where the bar appears {#where-the-bar-appears}

A small bar docks to the bottom of the HTML pages your app renders. Injection needs a
`text/html` response containing a `</body>` tag; anything else goes out untouched. Further
rules skip a response that would otherwise qualify:

- Peekaboot's own paths and the management endpoints: `/peekaboot/**`, `/static/`,
  `/webjars/`, `/error/`, and the actuator. This exclusion follows
  `management.endpoints.web.base-path`, so a relocated actuator stays excluded.
- An extension blocklist on the path: `.css`, `.js`, `.ico`, `.png`, `.jpg`, `.jpeg`,
  `.gif`, `.svg`, `.woff`, `.woff2`, `.ttf`, `.eot`.
- The header `X-Requested-With: XMLHttpRequest`, the only AJAX signal the filter looks at.
  A plain `fetch()` doesn't send it, so a `fetch` returning HTML with a `</body>` gets the
  bar injected like any page navigation.
- An async-started request. The handler keeps writing after the filter returns, so the
  response is handed over untouched and an endpoint that returns asynchronously gets no bar.

If generating the bar fails, the original page goes out unmodified rather than a broken one.

The bar also appears on the error page Peekaboot renders in place of Boot's whitelabel page
(see [Configuration, the error
page]({{ '/docs/configuration/' | relative_url }}#peekabooterrorpage)), reporting the request
that failed rather than the `/error` dispatch that renders the page. A direct request to
`/error/` is still excluded, as listed above.

The bar is server-rendered; everything on it is fetched from `/peekaboot/**`. Put Spring
Security in front of those paths and a reader outside the role gets the bar with a notice
instead of the numbers:

```
Peekaboot toolbar could not start — sign in, or check that its script is allowed to load
```

See [Security, the dev toolbar asks the reader to sign
in]({{ '/docs/security/' | relative_url }}#toolbar-requires-sign-in).

It mounts in its own shadow root: your CSS can't restyle it, and its styles can't leak into
your page.

## Request and response detail {#request-and-response-detail}

<figure class="image">
  <img src="{{ '/assets/img/screenshots/toolbar-collapsed-light.png' | relative_url }}"
       alt="The collapsed dev toolbar docked at the bottom of the page, showing a 200 status badge, GET /orders, the controller method, duration, query count and duration, and a copyable trace id"
       loading="lazy">
</figure>

The collapsed bar is the first look: response status (colour-coded), method and path, the
resolved controller method, request duration, the span count, database query count and
total query time, the log count, an error-log and a warn-log count when the request
produced either, and the trace id, copyable with one click. The numbers fill in
asynchronously: the bar re-fetches the trace four times over the first five seconds, so a
span finishing after the response still gets counted. With the toolbar's 200 ms export
delay (see [Configuration, what Peekaboot
sets]({{ '/docs/configuration/' | relative_url }}#what-peekaboot-sets-in-your-application)),
they are usually final on the first attempt or two.

The status pill has one tier per response family. 4xx and 5xx are deliberately held apart,
a soft red that recedes for the caller's mistake and the full one for yours; anything
unrecognised stays grey rather than borrowing the 5xx tier. The bar shows the number alone,
the overlay spells it out.

Click the bar, anywhere but the trace id and the dashboard link, or press Enter or Space
while it has focus. The Request tab then shows the whole exchange on one scrolling page.
First the request line: method, path, query string when there is one, status spelled out
as `404 Not Found`, and duration. Then the controller method, query and form parameters,
and last the two header tables, request before response. Sections below the request line
appear only when there is something in them. The header tables render either
way: "no headers captured" is an answer, where a vanished section reads as a missing
feature.

Headers and parameters are masked before they leave the server, by key name and by a few
value-shape patterns. There is no reveal control here: unlike the dashboard's Environment
and Config tabs, a masked value stays masked. See [Security,
Masking]({{ '/docs/security/' | relative_url }}#masking) for the rules and what they miss.
Bodies and uploaded file names aren't captured yet; a field is reserved for them that
nothing populates.

## The trace view {#the-trace-view}

<figure class="image">
  <img src="{{ '/assets/img/screenshots/trace-detail-light.png' | relative_url }}"
       alt="The expanded trace detail overlay for a GET /orders request, showing a span tree with nested CLIENT and SERVER spans, database connection and query spans, and timing bars"
       loading="lazy">
</figure>

The same click opens the full trace, the view the dashboard's Traces tab uses, without
leaving the page you're testing. It opens on the Spans tab, shown above: the whole tree,
every span's kind, tags and duration, nested exactly as they nested at runtime. Click a
span's name to open a details panel below its row, with the kind spelled out, a copyable
span id, and, where they apply, the error class and message, the SQL, and the tags with
full keys.

The Queries tab lists the SQL those spans ran, with duration and, where your
instrumentation provides them, row counts. A query at or above
`peekaboot.ui.tracing.slow-query-threshold-ms` (default 50ms) is labelled SLOW, on the
query threshold rather than the span thresholds. Peekaboot reads the SQL from
`db.query.text`, `db.statement` or datasource-proxy's `jdbc.query[N]`, whichever your
instrumentation sets, and falls back to the span's own name only when that already looks
like SQL.

<figure class="image">
  <img src="{{ '/assets/img/screenshots/trace-detail-queries-light.png' | relative_url }}"
       alt="The Queries tab for the same GET /orders request, listing 26 PostgreSQL statements with their duration and row count, each showing the actual lower-case select ... from SQL text rather than a span name"
       loading="lazy">
</figure>

That's the extracted text: lower-case, parameterized, one row per statement. The tree above
shows span *names* instead, which is why a database span there reads `SELECT customer_order`.
See [Traces]({{ '/docs/traces/' | relative_url }}#what-gets-captured) for what lands in the
store, and [trace status]({{ '/docs/traces/' | relative_url }}#trace-status) for what a
span, a root span and a trace status mean.

The tabs link into each other both ways. A database span's details panel carries a "Show in
Queries tab" button that jumps to that statement; a query, or a log line, jumps back to its
span in the tree. Each jump switches the tab, scrolls the target into view, focuses it and
highlights it briefly.

## Logs correlated to the request {#logs-correlated-to-the-request}

Every log line your app emitted while handling the request lands on the same overlay's Logs
tab: timestamp, level and message, tagged with the span that was active, filterable by
text, level or span. No grep, no correlation id to copy into another tool by hand. Log
content is captured verbatim and, unlike headers and parameters, is **not masked**: a
statement that includes a secret or PII is stored exactly as written. See
[Security]({{ '/docs/security/' | relative_url }}) for what's exposed once the toolbar is on.

## It also works from Swagger UI {#it-also-works-from-swagger-ui}

Swagger UI's own page has no request worth reporting on until you call an endpoint. So
there the toolbar loads idle, showing "Waiting for request…", and patches `window.fetch`.
Every response it sees is checked for a `Server-Timing` header, and the trace id in it
loads straight into the bar. Execute an operation through "Try it out" and the bar shows
that call's status, duration and query count; click it for the same overlay.

Peekaboot sets that header on the responses it traces, JSON API calls included. Its own
paths and the management endpoints aren't traced, so those never carry one, and neither
does a request that reached no span.

The `fetch` interceptor keeps a skip list of its own: `/v3/api-docs`, `/swagger-ui/`,
`/peekaboot/`, `/webjars/` and `/actuator/`. That last entry is Spring Boot's default
literal, hard-coded, so unlike the injection exclusion above this list does not follow
`management.endpoints.web.base-path`. A relocated actuator falls outside the skip list,
and Peekaboot doesn't trace it either, so no trace id lands on the bar.

A customised `springdoc.swagger-ui.path` is honoured. Wherever you've moved that page, the
UI is served from a `swagger-ui/` directory next to it, which is where the toolbar looks.
