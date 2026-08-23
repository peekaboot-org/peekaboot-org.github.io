---
title: Tracing
lead: In-memory request traces, no collector, no exporter to run &mdash; riding on the OpenTelemetry stack Spring Boot already gives you.
permalink: /docs/tracing/
---

Tracing is on by default (`peekaboot.tracing.enabled: true`). It doesn't stand up its own
tracing stack: it adds one more `SpanExporter` bean alongside whatever Spring Boot's own
OpenTelemetry auto-configuration already registered, and that exporter simply copies every
span it sees into an in-memory store instead of (or alongside) shipping it to a collector.
Turn tracing off and the rest of your OpenTelemetry setup &mdash; sampling, other
exporters &mdash; is untouched.

<div class="pk-callout" markdown="1">
There's no collector, no OTLP endpoint, and nothing leaves the process. If you also export
to Zipkin, Jaeger, or an OTLP backend, that keeps working independently &mdash; Peekaboot's
store is an additional destination for the same spans, not a replacement pipeline.
</div>

## What gets captured

Every span Spring Boot's OpenTelemetry integration produces lands in the store &mdash;
HTTP requests, scheduled jobs, message consumers, and whatever else your instrumentation
emits. Database queries aren't captured specially: a query shows up because the
JDBC/datasource instrumentation on your classpath (for example `datasource-proxy`, which
Peekaboot's own defaults tune for verbose SQL logging when present) already emits a span
for it, tagged with `db.*` or `jdbc.query*` attributes; Peekaboot only recognizes and
extracts those tags.

Two things are captured only when the [dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }})
is enabled (`peekaboot.dev-toolbar: true`, plus a `Tracer` bean):

- **Correlated logs.** Peekaboot's Logback appender, which tags each log event with the
  active trace/span id and feeds it into the same store, is registered as part of the dev
  toolbar's auto-configuration. Without the toolbar on, a trace's Logs tab stays empty.
- **Full request/response detail.** Headers, query and form parameters, and the
  resolved controller class/method all come from a filter that's likewise
  dev-toolbar-only. Without it, a trace still carries a basic method/path/status summary
  &mdash; read directly off the root span's own HTTP tags &mdash; but not headers or
  parameters. Request/response body content and uploaded file names have fields reserved
  for them in the trace data model but aren't populated by that filter yet &mdash; they
  aren't captured, regardless of dev-toolbar.

<div class="pk-callout pk-callout--warning" markdown="1">
This means correlated logs and full request detail aren't a baseline tracing feature:
they require `peekaboot.dev-toolbar: true`, whether or not you actually want the toolbar
UI injected into your pages.
</div>

## The three buckets

Traces land in up to three places at once:

- **All** &mdash; every trace, capped at `peekaboot.tracing.max-traces` (default 1000)
  and evicted after a fixed 30-minute time-to-live. This cap isn't currently exposed as a
  property.
- **Errors** &mdash; traces containing at least one span with an error, or an `ERROR`-level
  correlated log, capped at `peekaboot.tracing.max-error-traces` (default 100).
- **Slow** &mdash; traces whose *total duration* is at or above
  `peekaboot.tracing.slow-trace-threshold-ms` (default 1000ms), capped at
  `peekaboot.tracing.max-slow-traces` (default 100).

Errors and Slow are separate, independently bounded collections, not views over All: once
a trace qualifies, it's copied into its bucket and stays there under that bucket's own
eviction (oldest-first once the bucket is full) &mdash; not tied to the 30-minute TTL that
governs All. A trace can outlive its own eviction from All by having qualified as an error
or a slow trace early on.

See [Configuration]({{ '/docs/configuration/' | relative_url }}) for the full property
list and every other tracing default.

## The SLOW badge is not the Slow bucket

Two different thresholds produce two visually similar but distinct signals, and both can
be true for the same trace at once:

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-traces-light.png' | relative_url }}"
       alt="The Traces tab with a Slow (1) bucket filter, while four separate trace rows carry a SLOW badge"
       loading="lazy">
</figure>

- The **SLOW badge** on a trace row means *this trace contains at least one slow span*
  &mdash; a single span took at or above `peekaboot.ui.tracing.slow-span-threshold-ms`
  (default 100ms), or `very-slow-span-threshold-ms` (default 500ms) for the darker
  variant. This is a per-span check that walks the whole tree.
- The **Slow bucket** count means *this trace's total end-to-end duration* was at or above
  `peekaboot.tracing.slow-trace-threshold-ms` (default 1000ms) &mdash; a whole-trace check
  against a different, ten-times-larger threshold.

In the screenshot above, four rows carry a SLOW badge (each contains a span past the
100ms mark) while the Slow bucket itself reports only one trace (only one of those four
traces was, in total, slow enough to clear the 1000ms bucket threshold). Both numbers are
correct; they just answer different questions, and the badge threshold being an order of
magnitude smaller than the bucket threshold means the badge will almost always show up
more often than the bucket count would suggest.

## Span deduplication

Some instrumentation stacks emit two spans for what is really one operation &mdash; for
example, a JDBC driver-level span and a `datasource-proxy` span for the same query, one
wrapping the other with the same name and the same tags apart from which service or
datasource issued it. Peekaboot collapses a child span into its parent when they share a
name and their tags match once `peer.service` and `jdbc.datasource.name` are ignored; the
removed span's own children are re-parented onto the nearest surviving ancestor so the
tree stays connected.

Deduplication runs **on write**, as each span arrives at the trace store, not when a trace
is later read. `peekaboot.tracing.max-spans-per-trace` (default **500**) then caps the
already-deduplicated span count, so the cap counts real, distinct work rather than
counting a double-instrumented JDBC call as two spans against it. If a trace's
deduplicated span count still exceeds the cap, its **oldest** spans are dropped to make
room for new ones, exactly as before &mdash; the difference is what the cap is counting,
not whether it's enforced.

<div class="pk-callout pk-callout--warning" markdown="1">
**When the cap is genuinely hit, it's no longer silent.** The trace is flagged
`truncated: true`, exposed on both `GET /peekaboot/api/traces/insights` and `GET
/peekaboot/api/traces/{traceId}/insights`, and shown as a `TRUNCATED` badge in the trace
list and the trace-detail overlay &mdash; so a shortened trace is never mistaken for a
complete one. See [Configuration &mdash;
`max-spans-per-trace`]({{ '/docs/configuration/' | relative_url }}#max-spans-per-trace-deserves-more-than-a-table-row)
for raising the cap on a genuinely query-heavy endpoint.
</div>

## The `Server-Timing` header

When the dev toolbar is enabled, every response carries a `Server-Timing` header of the
form:

```
Server-Timing: trace;desc="00-{traceId}-{spanId}-{traceFlags}"
```

The `desc` value is a [W3C `traceparent`](https://www.w3.org/TR/trace-context/) payload
&mdash; version, trace id, span id and flags &mdash; packaged into a Server-Timing entry
named `trace`. The toolbar's own idle-mode script (used on pages like Swagger UI that
have no request of their own to report) reads this header off `fetch()` responses to pick
up a trace id for a call it didn't otherwise see; nothing stops any other tool that can
read response headers from doing the same. Like the request/log capture above, this
header is only sent while `peekaboot.dev-toolbar: true`.
