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
store is an additional destination for the same spans, not a replacement pipeline. See
[Tracing vs distributed tracing](#tracing-vs-distributed-tracing) for where that line
falls once more than one application is involved.
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
  and evicted after a fixed 30-minute time-to-live, which is not configurable.
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

## Tracing vs distributed tracing

Peekaboot's store and a tracing backend are not competing products. They answer different
questions, and past one application you want both.

### One word, two jobs

In OpenTelemetry's vocabulary a **trace** is one logical operation across however many
processes take part in it, stitched together by a trace id that travels between them in a
[W3C `traceparent` header](https://www.w3.org/TR/trace-context/). A checkout that touches
a gateway, an order service and a payment service is *one* trace with spans from three
JVMs.

Peekaboot's store holds only the spans **this process** exported. It doesn't interfere with
propagation &mdash; your application still sends and accepts `traceparent` exactly as
[Spring Boot's tracing support](https://docs.spring.io/spring-boot/reference/actuator/tracing.html)
configures it, whether or not Peekaboot is on &mdash; but it has no way to fetch the other
services' halves. Run Peekaboot in two services that call each other and you get two
partial traces, under one shared trace id, on two separate dashboards that cannot join
them. That is a property of running in-process with no backend, not a defect to be fixed
later.

### What a real backend is for

The moment more than one deployable is involved, the questions change shape, and every one
of these needs infrastructure Peekaboot deliberately doesn't have:

- **Joining a request across services.** One waterfall spanning every process it touched.
- **Retention past the process.** Peekaboot's traces are capped, evicted after 30 minutes,
  and gone entirely at restart. "What did this endpoint look like before last Tuesday's
  deploy?" needs storage that outlives the JVM.
- **Aggregation across instances.** Twelve pods behave differently from one, and you need
  the shape of all twelve at once.
- **Alerting.** Nothing in-process is going to page anyone.
- **True percentiles.** Real percentiles need retained samples; the aggregated levels on
  [Insights]({{ '/docs/insights/' | relative_url }}#percentiles-are-percentiles-of-aggregates)
  are honest about being percentiles *of aggregates* precisely because there are none.

The [Grafana stack](https://grafana.com/oss/grafana/) is the usual open-source answer, and
it's split along the same lines as the questions:
[Tempo](https://grafana.com/oss/tempo/) for traces, [Loki](https://grafana.com/oss/loki/)
for logs, [Mimir](https://grafana.com/oss/mimir/) or
[Prometheus](https://prometheus.io/) for metrics, with Grafana over the top of all three.
[Jaeger](https://www.jaegertracing.io/) and [Zipkin](https://zipkin.io/) are the
long-standing trace-only options, [SigNoz](https://signoz.io/) bundles the three signals
into one product, and the [OpenTelemetry
Collector](https://opentelemetry.io/docs/collector/) is the piece in the middle that lets
you change your mind about any of them without touching application code. If you want to
try the whole thing locally before committing to running it, Grafana publishes
[docker-otel-lgtm](https://github.com/grafana/docker-otel-lgtm) &mdash; the stack in a
single container.

Spring Boot already speaks to all of them. The spans Peekaboot copies are the same spans
your OTLP exporter ships; adding one doesn't cost you the other.

### Why Peekaboot still earns its place

Not as a smaller backend &mdash; as a different tool for the ten seconds after you hit a
page:

- **Nothing to run first.** No collector, no agent, no container, no retention policy, no
  dashboard to build. Add the dependency, start the app, and the trace of the request you
  just made is already there. A backend that a developer has to stand up before they can
  see anything is a backend most developers won't stand up.
- **It's on the page you're already looking at.** The [dev
  toolbar]({{ '/docs/dev-toolbar/' | relative_url }}) puts the current request's spans,
  queries and logs at the bottom of the page that produced them &mdash; no separate UI, no
  copying a trace id into a search box, no wondering whether you're looking at the right
  request.
- **Everything is captured, always.** Peekaboot sets
  `management.tracing.sampling.probability: 1.0` (see [Auto-configured
  defaults]({{ '/docs/auto-configured-defaults/' | relative_url }})), because in-process
  capture has no per-span bill attached. Backends are sampled for cost, which is exactly
  why the one request you care about is so often the one that wasn't kept.
- **More detail per request than a backend usually keeps.** Full request and response
  headers, query and form parameters, the resolved controller method, SQL text, and every
  log line the request emitted correlated to the span that emitted it &mdash; volumes that
  are unaffordable at fleet scale and completely free for one developer's laptop.
- **It's additive, never a replacement.** Peekaboot's store is one more destination for
  spans you're already producing. Your OTLP exporter, sampling configuration and existing
  pipeline keep working unchanged, and turning `peekaboot.tracing.enabled` off leaves them
  exactly as they were.
- **It stays out of production.** Peekaboot defaults off outside a local run, and it turns
  Micrometer's OTLP metrics export *off* rather than letting telemetry leave the process by
  accident. It isn't trying to be your production observability story; that's the backend's
  job, and it's a good one.

The honest split: use Peekaboot while you're writing the code, and a backend to understand
the system once it's running somewhere you aren't.
