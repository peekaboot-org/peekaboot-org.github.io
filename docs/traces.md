---
title: Traces
lead: In-memory request traces on the OpenTelemetry stack Spring Boot already gives you, with nothing to run first.
permalink: /docs/traces/
redirect_from:
  - /docs/tracing/
  - /docs/concepts/
---

Tracing is on by default (`peekaboot.tracing.enabled: true`). Spans your application
already produces are copied into an in-memory store as the OpenTelemetry SDK exports them.
Nothing to install, no collector to run, no endpoint to configure.

<div class="pk-callout" markdown="1">
Peekaboot's store is one more destination, registered as an ordinary span exporter beside
whatever else you have configured. An existing OTLP, Zipkin or Jaeger pipeline keeps
working unchanged, and turning `peekaboot.tracing.enabled` off leaves it exactly as it
was.

Peekaboot itself pushes nothing out of the process: it adds no exporter of its own and
turns Micrometer's OTLP metrics export off.
</div>

<div class="pk-callout pk-callout--warning" markdown="1">
**Peekaboot raises three observations of its own.** Two around each request
(`spring.handler`, `spring.view.render`) and one around each task handed to a Spring task
executor (`peekaboot.async.task`). They are ordinary Micrometer observations, so they reach
every exporter you have configured, not only Peekaboot's store.

[What gets captured](#what-gets-captured) names all three with their tags.
`peekaboot.tracing.async` turns the async one off on its own;
`peekaboot.tracing.enabled: false` removes all three. Everything else in the store is a span
your application already produced.
</div>

## The vocabulary {#the-vocabulary}

**Trace.** Everything Peekaboot recorded for one unit of work: one HTTP request, one run of
a scheduled job, one message handled off a queue. Every trace has an id, shown throughout
the UI, to copy and search your logs with.

**Span.** One unit of work inside a trace: handling the request, each database query, each
outbound call to another service. Spans nest into the tree the overlay's Spans tab draws.

**Query span.** A client-side span carrying `db.*` or `jdbc.query*` tags, the client half
of a database call, tagged either by the OpenTelemetry conventions or by datasource-proxy.
That one definition drives the Queries tab, every query count, and the SLOW_QUERY issue
below. A span whose name merely looks like SQL is not a query span, and neither are
datasource-proxy's connection and result-set spans, which carry `jdbc.` tags without a
query.

**Root span.** The span at the top of the tree, the one nothing else is nested under: the
request itself for an HTTP request, the job invocation for a scheduled job.

**Root operation.** The root span's name, shown in the trace list exactly as the
instrumentation wrote it: `http get /orders`, `http get /api/orders/{id}/report`, or, for a
`@Scheduled` method, `task orderReconciler.reconcileOrders`.

## What gets captured {#what-gets-captured}

Every span the OpenTelemetry SDK exports is copied into the store: HTTP requests, scheduled
jobs, message consumers, and the database queries they run. The starter instruments JDBC out
of the box, so queries show up without wiring anything up. A host that instruments its own
`DataSource` excludes the starter's copy, or sets `jdbc.datasource-proxy.enabled=false`.

Three things bound what gets captured:

- **The OpenTelemetry SDK has to be on the classpath.** There is no Brave bridge, so an
  application wired to Brave instead gets a Traces tab that is present and empty.
- **Only sampled spans reach any exporter.** Peekaboot sets
  `management.tracing.sampling.probability` to `1.0` where Spring's own default is `0.1`,
  as a default your own setting overrides. Sample at 10% and Peekaboot sees 10%.
- **Some path prefixes are never captured at all:** `/static/`, `/webjars/`, `/peekaboot/`,
  `/error/`, and the management base path (`/actuator/` at Spring Boot's default, following
  `management.endpoints.web.base-path`). Excluding a request's root span discards the whole
  trace, which is why Peekaboot's own dashboard traffic never appears in its own list.

Peekaboot contributes three spans of its own, only while `peekaboot.enabled` and
`peekaboot.tracing.enabled` are both on. Two sit on the request path, under the same
exclusions as everything else:

- `spring.handler` around the controller method, tagged `handler.type` and `handler.name`.
- `spring.view.render` around view rendering, tagged `view.type` and `view.name`, raised
  only when the handler resolved a view, so a `@ResponseBody` controller produces none.

The third sits outside it. `peekaboot.async.task` wraps each task handed to one of Spring's
task executors, tagged `peekaboot.async` and `peekaboot.async.thread`, and is raised only
when the thread that handed the task over already had a trace in scope.
`peekaboot.tracing.async: false` turns that one off by itself. See [background
work](#background-work) for what it needs from your application and what it changes in the
UI.

All three are ordinary observations, so every configured exporter sees them, and turning
tracing off removes them from those exporters along with the store. The handler span stays
current for the length of the controller method, so spans opened inside it (JDBC, HTTP
clients) nest under it rather than under the HTTP server span.

One trace holds at most `peekaboot.tracing.max-spans-per-trace` spans (default 500). Past
that the oldest spans are dropped and the trace carries a **TRUNCATED** badge in the list.

The SQL on the Queries tab is whatever the instrumentation recorded. A query span carrying
no statement text is still listed, without SQL. A JDBC batch is one span and one entry,
with its statements joined together.

With the [dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}) also on, a trace also
carries correlated logs (up to `peekaboot.tracing.max-logs-per-trace`, default 500, oldest
dropped first) and full header and parameter capture for request and response. That page
has the detail, including what it does not capture.

## Root action type {#root-action-type}

The root action type classifies what started the trace. It supplies the icon next to each
row and the type filter on the trace list. Peekaboot works it out from the root span alone,
checking a fixed list of rules **in priority order** and stopping at the first match, not
the most specific-sounding one.

| Priority | Value | Icon | Means | Recognized by |
|---|---|---|---|---|
| 1 | Message Consumer | 📩 | A message picked off a queue or topic | The root span is consumer-side, or carries messaging tags without being producer-side. Checked first, so a consumer-side span whose name happens to contain "job" or "cron" is still Message Consumer. Messaging tags alone do not decide it: a span *sending* a message carries exactly the same ones |
| 2 | HTTP Request | 🌐 | An inbound web request, recognized from its own tags | The root span is server-side **and** carries HTTP tags: any `http.` tag, or `method` and `uri` together |
| 3 | RPC Call | 🔗 | An inbound remote-procedure call (gRPC, for example) | The root span is server-side **and** carries `rpc.` tags |
| 4 | HTTP Request (fallback) | 🌐 | Any other inbound web request, one that carried no HTTP-specific tags | The root span is server-side, full stop. Rules 2 to 4 between them catch every server-side span, so no rule below ever sees one |
| 5 | Async Task | ⚡ | Background work Peekaboot observed on one of Spring's task executors | The root span carries Peekaboot's own `peekaboot.async` tag. Checked ahead of every rule under it, being Peekaboot's own marker rather than an inference from someone else's convention. The entry span carries no span kind, so rule 9 would otherwise swallow it. See [background work](#background-work) |
| 6 | Scheduled Job | 🕑 | A `@Scheduled` method Spring's scheduler actually fired | The root span carries the `code.function` and `code.namespace` tags Spring's scheduler sets when it dispatches a `@Scheduled` method. It sits above every rule below it because a scheduled invocation carries no span kind at all, and it wins over Database and Unknown on a client- or producer-side root too |
| 7 | Database | 🗂 | A database call with nothing above it in the trace | The root span is client-side **and** carries `db.` tags. Rare: it means something queried a database with no request, job or message context around it that Peekaboot could see |
| 8 | Connection Pool | 🔌 | The pool acquiring or validating a connection outside any traced work | The root span is client-side, named `connection`, carries the datasource tags, and has no parent in the trace. Checked after row 7, so a query span that also carries pool tags stays Database |
| 9 | Internal | ⚙ | The trace has no inbound or outbound direction at all | The root span carries no span kind: not client, server, producer or consumer. Messaging tags still win, so a kind-less span carrying them is Message Consumer |
| 10 | Unknown | ❓ | Nothing above matched | A producer-side span, meaning a message being sent rather than received; or a client-side span with no database tags. The second shape includes an outbound HTTP or RPC call that became the root only because its own caller's span has not reached Peekaboot |

HTTP Request appears twice on purpose. The strict tag check sits at priority 2, the
fallback at priority 4, sweeping up whatever server-side spans it left.

<div class="pk-callout" markdown="1">
**Scheduled Job only recognizes a `@Scheduled` method that Spring's own scheduler actually
dispatched.** It matches on the tag pair that scheduler sets, never on a bean or method
name.

- **A scheduler Spring does not manage is not Scheduled Job.** Quartz, a raw
  `ScheduledExecutorService`, or any other timer outside Spring's `@Scheduled` machinery
  falls through to Internal, or to whatever else its tags match. Guessing from a name
  containing "job", "cron" or "timer" would be wrong more often than right.
- **Calling a `@Scheduled` method directly does not count either.** If the method is also
  `@Observed`, that aspect's own span becomes the root, carrying `class` and `method` tags
  no rule recognizes, and the trace classifies Internal.
</div>

### Connection Pool traces are hidden by default {#connection-pool-traces-hidden}

The pool refills and validates connections on its own schedule, outside any traced work,
and enough arrive to drown everything else. They stay in the store but are left out of the
listing endpoint's unfiltered view, so the Traces tab hides them until you tick the
Connection Pool filter. Over the API,
[`rootActionType=*`]({{ '/docs/api/' | relative_url }}#endpoints) asks for every type at
once.

A pool acquisition *inside* traced work is an ordinary child span, never classified. Only a
connection span with no parent in the trace reaches rule 8.

## Background work {#background-work}

A task handed to one of Spring's task executors runs on another thread. The trace context
does not follow it by default, so the work starts a trace of its own with nothing to say what
triggered it. Turn `spring.task.execution.propagate-context` on and the context travels;
Peekaboot then raises `peekaboot.async.task` around the task, and the work lands in the trace
that submitted it.

<div class="pk-callout pk-callout--warning" markdown="1">
**Peekaboot does not set `spring.task.execution.propagate-context`. Your application does.**
Without it there is no trace on the executor thread to continue, so Peekaboot raises nothing
and background work keeps starting traces of its own. An application that wants its own
bounded pool for this needs `spring.task.execution.mode=force` as well. Both are covered
under [`peekaboot.tracing`]({{ '/docs/configuration/' | relative_url }}#peekaboottracing).
</div>

A `@Scheduled` run is untouched. It keeps its Scheduled Job type and gets no async span, even
though Spring hands the same decorator to its scheduler.

### The triggering trace is timed without it {#async-timing}

A request that returns in 50ms reports 50ms, however long the task it started runs
afterwards. The trace's duration, the span-duration total on its Spans tab, the window those
bars are measured against and admission to the Slow bucket all read the synchronous part
alone.

Counts are not filtered the same way. A background task that fails still puts its trace in
Errors and shows it as HAS_ERRORS, and its query spans still count on the Queries tab. Only
the duration figures misrepresent what the caller waited for, so only those exclude the
subtree.

### Background work gets its own row {#async-rows}

Each entry point is listed separately, typed Async Task and timed by its own subtree rather
than by the trace around it. One trace can therefore produce several rows, and a type filter
selects rows rather than traces: filter for HTTP Request and you get the request, filter for
Async Task and you get the work it started. A row carries a ⤴ link to the trace that
triggered it while that trace is still in the store; a task whose trace has already been
evicted is listed on its own.

Opening an async row opens the Spans tab scoped to that subtree, timed against the subtree's
own window. In the triggering trace's own Spans tab the same subtree starts collapsed and its
entry span carries a **background** chip. Its spans are drawn against the subtree's own window
rather than the trace's, so a four-minute task cannot crush a 50ms request into an invisible
sliver.

### The span is named `async task` {#async-naming}

A `TaskDecorator` receives an opaque `Runnable`, so the method behind it is unrecoverable and
every async entry span carries the same name. A name that says something has to come from
the application, through `@Observed(contextualName = "...")` on the method or the child spans
the task produces.

## Trace status {#trace-status}

A trace's status is one of exactly two values: **OK**, or **HAS_ERRORS** when any span in
the trace ended with an error. There is no third, slow status. Slowness is a span issue and
the Slow bucket, both below.

## Issues {#issues}

An issue is a problem Peekaboot detected on one span, shown as a coloured marker in the
span tree.

Every threshold below binds under `peekaboot.ui.tracing.`; see
[Configuration]({{ '/docs/configuration/' | relative_url }}#peekabootuitracing) for the
full property list.

| Type | Fires when | Threshold (default) | Severity |
|---|---|---|---|
| VERY_SLOW | The span's own duration reaches the threshold. Checked before SLOW, so a span carries one or the other, never both | `very-slow-span-threshold-ms` (500) | Error |
| SLOW | The span's own duration reaches the threshold and it did not already raise VERY_SLOW | `slow-span-threshold-ms` (100) | Warning |
| ERROR | The span ended with an error | none | Error |
| SLOW_QUERY | A query span's duration reaches the threshold | `slow-query-threshold-ms` (50) | Warning |

SLOW, VERY_SLOW and SLOW_QUERY all fire at or above their threshold.

## The three buckets {#the-three-buckets}

Every trace lands in All, and in Errors or Slow too when it qualifies:

- **All** holds every trace, capped at `peekaboot.tracing.max-traces` (default 1000).
- **Errors** holds traces with at least one errored span, or at least one `ERROR`-level
  correlated log, capped at `peekaboot.tracing.max-error-traces` (default 100). Logs are
  only captured while the dev toolbar is on, so with it off this bucket admits on errored
  spans alone.
- **Slow** holds traces whose *total* wall-clock duration is at or above
  `peekaboot.tracing.slow-trace-threshold-ms` (default 1000ms), capped at
  `peekaboot.tracing.max-slow-traces` (default 100). [Background work](#background-work) is
  not part of that duration, so a fast request that started a slow task stays out.

Nothing expires on a clock. Each bucket evicts its own oldest entry once its own cap is
full, where oldest means first admitted; a trace that keeps receiving spans does not move.
A late span for an already-evicted trace puts it back at the newest end. The three are independent, so a trace can keep showing
under Errors or Slow long after it aged out of All.

See [Configuration]({{ '/docs/configuration/' | relative_url }}#peekaboottracing) for every
other tracing default.

## The SLOW badge is not the Slow bucket {#slow-badge-vs-slow-bucket}

Two thresholds produce two similar-looking signals, and both can be true of the same trace
at once.

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-traces-light.png' | relative_url }}"
       alt="The Traces tab showing a Slow (1) bucket count while four separate trace rows carry a SLOW badge"
       loading="lazy">
</figure>

- The **SLOW badge** on a trace row means *this trace contains at least one slow span*: a
  single span reached `peekaboot.ui.tracing.slow-span-threshold-ms` (default 100ms). A span
  past `very-slow-span-threshold-ms` (default 500ms) produces the same badge; that
  threshold colours span, query and duration text in the trace detail overlay, never the
  row badge.
- The **Slow bucket** count means *this trace's total end-to-end duration*, background work
  excluded, reached `peekaboot.tracing.slow-trace-threshold-ms` (default 1000ms), a
  whole-trace check against a threshold ten times larger.

In the screenshot, four rows carry a SLOW badge while the Slow bucket reports one trace:
only one of the four was past 1000ms end to end. The smaller badge threshold fires far more
often.

One caveat when counting badges. **A trace that errored shows the ERROR badge instead of
the SLOW badge**, never both. A slow trace that also failed is invisible to a count of SLOW
badges, which undercounts slow traces whenever any errored. The TRUNCATED badge is separate
and can sit beside either.

## Tracing vs distributed tracing {#tracing-vs-distributed-tracing}

Peekaboot's store and a tracing backend answer different questions. Past one application
you want both.

### One word, two jobs {#one-word-two-jobs}

In OpenTelemetry's vocabulary a **trace** is one logical operation across however many
processes take part in it, stitched together by a trace id that travels in a
[W3C `traceparent` header](https://www.w3.org/TR/trace-context/).

Peekaboot's store holds only the spans **this process** exported. It reads trace context
and never writes it, so your application sends and accepts `traceparent` exactly as
[Spring Boot's tracing support](https://docs.spring.io/spring-boot/reference/actuator/tracing.html)
configures it, with or without Peekaboot. It cannot fetch the other services' halves. Run
it in two services that call each other and you get two partial traces, under one shared
trace id, on two dashboards that cannot join them. That follows from running in-process
with no backend. It is not a defect awaiting a fix.

### What a real backend is for {#what-a-real-backend-is-for}

Every one of these needs infrastructure Peekaboot deliberately does not have:

- **Joining a request across services.** One waterfall spanning every process it touched.
- **Retention past the process.** Peekaboot's traces are capped, evicted oldest-first, and
  gone at restart. Anything from before last Tuesday's deploy needs storage that outlives
  the JVM.
- **Aggregation across instances.** Twelve pods behave differently from one, and you need
  all twelve at once.
- **Alerting.** Nothing in-process is going to page anyone.
- **True percentiles.** Real percentiles need retained samples, which is why the aggregated
  levels on
  [Insights]({{ '/docs/insights/' | relative_url }}#percentiles-of-aggregates)
  are explicit about being percentiles *of aggregates*.

The [Grafana stack](https://grafana.com/oss/grafana/) is the usual open-source answer,
split along the same lines: [Tempo](https://grafana.com/oss/tempo/) for traces,
[Loki](https://grafana.com/oss/loki/) for logs, [Mimir](https://grafana.com/oss/mimir/) or
[Prometheus](https://prometheus.io/) for metrics, with Grafana over the top.
[Jaeger](https://www.jaegertracing.io/) and [Zipkin](https://zipkin.io/) are the
long-standing trace-only options, [SigNoz](https://signoz.io/) bundles the three signals
into one product, and the [OpenTelemetry
Collector](https://opentelemetry.io/docs/collector/) sits in the middle so you can change
your mind without touching application code.
[docker-otel-lgtm](https://github.com/grafana/docker-otel-lgtm) packs the whole Grafana
stack into one container for a local trial.

Spring Boot already speaks to all of them, and adding Peekaboot costs you none of it.
