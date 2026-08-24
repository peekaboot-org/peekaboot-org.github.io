---
title: Tracing
lead: In-memory request traces, no collector, no exporter to run &mdash; riding on the OpenTelemetry stack Spring Boot already gives you.
permalink: /docs/tracing/
---

Tracing is on by default (`peekaboot.tracing.enabled: true`). As soon as your app starts,
every span your OpenTelemetry setup already produces is copied into Peekaboot's in-memory
store &mdash; nothing else to install or configure. Turn tracing off and the rest of your
OpenTelemetry setup, sampling and any other exporters included, keeps working exactly as
before.

<div class="pk-callout" markdown="1">
There's no collector, no OTLP endpoint, and nothing leaves the process. If you also export
to Zipkin, Jaeger, or an OTLP backend, that keeps working independently &mdash; Peekaboot's
store is an additional destination for the same spans, not a replacement pipeline.
</div>

## What gets captured

Every span your application produces lands in the store &mdash; HTTP requests, scheduled
jobs, message consumers, and &mdash; where your datasource instrumentation emits spans
for them &mdash; the database queries they run.

With the [dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}) also on, a trace
additionally carries correlated logs and full header and parameter capture for the
request and response &mdash; that page has the detail, including what it still
doesn't capture.

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

A trace can qualify for Errors or Slow and keep showing up there even after it's aged out
of All &mdash; each bucket keeps its own history, on its own limit.

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
  variant.
- The **Slow bucket** count means *this trace's total end-to-end duration* was at or above
  `peekaboot.tracing.slow-trace-threshold-ms` (default 1000ms) &mdash; a whole-trace check
  against a different, ten-times-larger threshold.

In the screenshot above, four rows carry a SLOW badge (each contains a span past the
100ms mark) while the Slow bucket itself reports only one trace (only one of those four
was, in total, slow enough to clear the 1000ms bucket threshold). Both numbers are
correct; they just answer different questions, and the badge threshold being an order of
magnitude smaller than the bucket threshold means the badge will almost always show up
more often than the bucket count would suggest.
