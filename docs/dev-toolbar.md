---
title: Dev toolbar
lead: Request and response detail, the trace view, and logs correlated to the request &mdash; injected into the page you're already looking at.
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
one. Once it's on, a small bar docks to the bottom of every HTML page your app renders
&mdash; not static assets, not `/actuator/**` or `/peekaboot/**` themselves, and not AJAX
requests &mdash; and if anything goes wrong generating it, the original page goes out
unmodified rather than a broken one.

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
and the trace id, copyable with one click. Those metrics fill in asynchronously &mdash;
the bar fetches the trace's insights on a fixed four-attempt schedule (250ms, 500ms, 1s
and 3s after the previous attempt, the last landing around 4.75s after the response
arrived) and re-renders each time, so a span that finishes after the response already
went out still gets counted. Peekaboot's own 200ms trace-export delay when the toolbar is
on (see [Auto-configured defaults]({{ '/docs/auto-configured-defaults/' | relative_url }}))
normally means the numbers are already final well before the last attempt.

Click anywhere on the bar &mdash; other than the trace id or the dashboard link, which
have their own targets &mdash; and its Request tab shows the request and response: every
header on both sides, query and form parameters, and the resolved controller/handler
method. Headers and parameters are masked by the same engine that
masks everything else Peekaboot shows: a value whose key looks sensitive (`password`,
`authorization`, `cookie`, and the like) is replaced outright, and a handful of
value-shape patterns catch a credential &mdash; a JWT, an AWS key, a JDBC URL's embedded
password &mdash; sitting under an innocuous key. There's no reveal control here; unlike
the dashboard's Environment and Config tabs, a masked header or parameter stays masked.
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
duration and, where your instrumentation provides them, row counts &mdash; recognizing
OpenTelemetry's `db.query.text`/`db.statement` tags and `datasource-proxy`'s
`jdbc.query[N]` tags, in that order, and falling back to a span's own name only when none
of those tags are present and that name already looks like SQL. The tree above shows a
span's *name*, not extracted SQL &mdash; which is why a database span there can read
`SELECT customer_order` rather than the statement itself: that's OpenTelemetry's own
summary form for the span, correct for a span tree, and rendered by a completely
different code path than the Queries tab, independent of what that tab's own fallback
does. See
[Tracing]({{ '/docs/tracing/' | relative_url }}) for what's actually captured, and
[Concepts]({{ '/docs/concepts/' | relative_url }}) for what a span, a root span and a
trace status mean.

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
