---
title: Traces
lead: The last 1,000 requests, jobs and messages your application handled, with their spans, SQL and logs, kept in memory and, on a local run, on disk.
permalink: /docs/traces/
redirect_from:
  - /docs/tracing/
  - /docs/concepts/
---

Peekaboot keeps a copy of every span your application exports in an in-memory store. The
dashboard's Traces tab lists them, and the [dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }})
shows the trace of the page you are looking at.

{% include facts/local-run-disk.md %}

Existing OTLP, Zipkin or Jaeger exports keep working unchanged. Peekaboot adds no exporter that
sends data out of the process, and it turns Micrometer's OTLP metrics export off.

## Requirements {#requirements}

- `peekaboot.enabled=true`. It defaults to true only for a [local
  run]({{ '/docs/configuration/' | relative_url }}#local-run).
- `peekaboot.tracing.enabled`, which defaults to `true`.
- A servlet web application. A WebFlux application records no traces.
- The OpenTelemetry SDK, which the starter brings. An application that uses the Brave bridge
  instead gets an empty Traces tab.

Queries appear for JDBC only. R2DBC is not instrumented. If you instrument your `DataSource`
yourself, exclude the starter's `datasource-micrometer` or set
`jdbc.datasource-proxy.enabled=false`.

## What gets recorded {#what-gets-captured}

Every span your application exports: HTTP requests, scheduled jobs, message consumers, and
the database queries and outbound calls they make.

| Property | Spring Boot default | With Peekaboot |
|---|---|---|
| `management.tracing.sampling.probability` | `0.1` | `1.0`, so every request is recorded |

Your own setting wins. Peekaboot sees only sampled spans: at 10% it records 10%.

These request paths are never recorded:

- `/static/`, `/webjars/` and `/error/`.
- `/peekaboot/`. Your other exporters and the `http.server.requests` metrics do not see these
  requests either.
- The management base path, `/actuator/` by default, following
  `management.endpoints.web.base-path`.

Each trace also holds the request and response headers and parameters and the log lines
written while handling it. Log lines written outside any trace are kept as well, the newest
`peekaboot.tracing.max-untraced-logs` (1,000), for the [log
search]({{ '/docs/api/' | relative_url }}#log-search).

## Spans Peekaboot adds {#spans-peekaboot-adds}

Peekaboot raises four Micrometer observations of its own. Every exporter you configured receives
these spans too.

| Span | Around |
|---|---|
| `<Class>.<method>` | The controller method |
| `<view name>` | View rendering, when the handler resolved a view |
| `async task` | A task run on one of Spring's task executors, see [background work](#background-work) |
| `<Class>#<method>` | An event listener method, see [event listeners](#event-listeners) |

`peekaboot.tracing.async=false` turns off the async span alone, and
`peekaboot.tracing.event-listeners=false` the listener spans. `peekaboot.tracing.enabled=false`
removes all four.

## Background work {#background-work}

Work handed to a Spring task executor, for example an `@Async` method, runs on another thread.
It appears inside the trace that started it only when the trace context follows it there.
{% include facts/propagate-context.md %}

<div class="pk-callout pk-callout--warning" markdown="1">
With the property off, Peekaboot records no `async task` span and no row is of type Async
Task. The queries and outbound calls a task makes become traces of their own, typed by the
call, with nothing linking them to the request that started them.
</div>

Tasks on executors that Spring Boot builds get the span. With an `Executor` bean of your own,
set `spring.task.execution.mode=force` to keep Boot's `applicationTaskExecutor`.

With context propagation on, each task gets an `async task` span inside the trace that submitted
it. The request's duration and the [Slow bucket](#the-three-buckets) check leave the background
work out: a request that returns in 50ms reports 50ms, however long its task runs. A task that
throws fails its span and puts the trace in Errors, except with `submitCompletable()` and under
`@EnableAsync(mode = AdviceMode.ASPECTJ)`.

{% include screenshot.html name="trace-detail-async" %}

Each task is also listed as its own row of type Async Task, timed on its own. It links to the
trace that started it while that trace is still in the store. One trace can therefore produce
several rows.
{: #async-rows}

Every async span is named `async task`. To see which method ran, put
`@Observed(contextualName = "...")` on it. Its span then appears under `async task`.

## Event listeners {#event-listeners}

Each call of an `@EventListener` or `@TransactionalEventListener` method gets a span named after
the method, such as `OrderConfirmationListener#onOrderPlaced`. It nests under the work that
published the event. An `@Async` listener needs `spring.task.execution.propagate-context`, like
any [background work](#background-work). A listener that cannot be proxied, such as one in a final
class, gets no span.

Listener beans become proxies, so `getClass()` on the injected bean returns the proxy class. Use
`ClassUtils.getUserClass` for the declared one.

## Trace types {#root-action-type}

Each row in the trace list shows what started the trace. The Traces tab filters by it.

| Type and API value | Means |
|---|---|
| 🌐 HTTP<br>`HTTP_REQUEST` | An inbound web request |
| 📩 Messaging<br>`MESSAGE_CONSUMER` | A message picked off a queue or topic |
| 🔗 RPC Call<br>`RPC_CALL` | An inbound remote-procedure call, gRPC for example |
| 🕑 Scheduled<br>`SCHEDULED_JOB` | A `@Scheduled` method fired by Spring's scheduler |
| ⚡ Async Task<br>`ASYNC_TASK` | [Background work](#background-work) on a Spring task executor, only with context propagation on |
| 🗂 Database<br>`DATABASE` | A database call with no request, job or message around it |
| 🔧 Maintenance<br>`MAINTENANCE` | Upkeep outside any traced work: a pool acquiring or validating a connection, a Redis connection handshake or health check |
| ❓ Unknown<br>`UNKNOWN` | Anything else, such as in-process work, a message being sent, or an outbound call whose caller was not traced or has not arrived yet |

Maintenance traces arrive often enough to drown everything else. The Traces tab excludes
them until you untick Maintenance under Excluded. Over the HTTP API,
[`rootActionType=*`]({{ '/docs/api/' | relative_url }}#endpoints) returns every type.
{: #maintenance-traces-hidden}

## The trace detail {#the-trace-view}

Click a row on the Traces tab, or click the dev toolbar, to open a trace's detail. It has four
tabs and opens on Spans.

{% include screenshot.html name="trace-detail" %}

**Spans** shows the span tree, nested as the spans ran.

- Each span shows its kind, tags, duration and, where children covered part of it, self time.
  Click its name for issues, full tags, the exception with its stack trace, the query or its
  log lines.
- When the trace failed, the header names its cause and links to the span.
- Most self time, above the tree, lists up to three spans that spent the longest on their own
  work.

{% include screenshot.html name="trace-detail-queries" %}

**Queries** lists the SQL the trace ran, one row per statement.

- Each row shows its duration and row count. A query at or above
  `peekaboot.tracing.slow-query-threshold-ms` (default 50ms) is marked SLOW.
- Bind parameters are listed under the statement, masked like the SQL. Substitute parameters
  puts them in place of the `?` placeholders.

Bind parameters are limited per statement to 1,000 characters a value, 100 parameter sets and
16,000 characters in all. Past a limit they are cut and the statement says how much is omitted.

**Logs** lists the log lines written while handling the request, filterable by text, level and
span.

**Request** shows the method, path, query string, status, duration, controller method,
parameters, and request and response headers. See [Dev
toolbar]({{ '/docs/dev-toolbar/' | relative_url }}#request-and-response-detail) for what is masked
and what is not.

## Outcome and issues {#trace-status}

A trace's outcome is one of these.

| Outcome | Means |
|---|---|
| OK | No failure. A 4xx answer is a CLIENT_ERROR issue and leaves the outcome OK |
| ERROR | A span failed, a server span answered with a 5xx, or a line was logged at `ERROR`. This also puts the trace in Errors |
| IN PROGRESS | The root span has not arrived yet. The request may still be running |
| INTERRUPTED | A trace restored from an earlier run that stopped before the trace's root arrived |

A 4xx stays OK and out of Errors and the error digest, also where a view rendered an exception
for it, such as the page [`peekaboot.error-page.override`]({{ '/docs/error-page/' | relative_url }}#override)
renders. A view that answers with a 5xx still fails the trace.
{: #exception-views}

### Issues {#issues}

An issue marks one span in the tree. The thresholds live under `peekaboot.tracing`, see
[Configuration]({{ '/docs/configuration/' | relative_url }}#issue-thresholds).

| Issue | Raised when | Property (default) | Severity |
|---|---|---|---|
| VERY_SLOW | The span's self time, its duration minus the time its child spans cover, reaches the threshold | `very-slow-span-threshold-ms` (500) | Error |
| SLOW | The span's self time reaches the threshold, and it is not VERY_SLOW | `slow-span-threshold-ms` (100) | Warning |
| SLOW_QUERY | A query's duration reaches the threshold | `slow-query-threshold-ms` (50) | Warning |
| REPEATED_QUERY | The span's direct children run the same statement, literals ignored, this many times or more | `repeated-query-threshold` (5) | Warning |
| CLIENT_ERROR | The request was answered with a 4xx | none | Warning |

"Reaches" means at or above the threshold. Every issue carries its value and the threshold it
reached, see [HTTP API, issue fields]({{ '/docs/api/' | relative_url }}#issue-fields).

REPEATED_QUERY finds the N+1 pattern. Statements that differ only in string or number literals
count as the same. CLIENT_ERROR is raised on the root server span only.

The Spans tab colours a span's duration by its SLOW, VERY_SLOW and SLOW_QUERY issues, and marks
REPEATED_QUERY and CLIENT_ERROR with a badge on their span.

## Buckets, limits and memory {#the-three-buckets}

Every trace is in All. A trace that qualifies is also in Errors, Slow, or both.

| Bucket | Holds | Size property (default) |
|---|---|---|
| All | Every trace | `peekaboot.tracing.max-traces` (1000) |
| Errors | Traces with an errored span, a 5xx answer or an `ERROR` log line | `peekaboot.tracing.max-error-traces` (100) |
| Slow | Traces whose duration, [background work](#background-work) excluded, reaches `peekaboot.tracing.slow-trace-threshold-ms` (1000) | `peekaboot.tracing.max-slow-traces` (100) |

A full bucket drops the trace it admitted first. The buckets evict independently, so a trace can
stay under Errors or Slow after it has left All. Nothing expires on a timer.

One noisy failure can fill Errors and push every other failure out. The [error
digest]({{ '/docs/api/' | relative_url }}#error-digest) keeps counting every failure, one entry
per exception class, route and application frame, after its traces are gone.

One trace is limited in size:

| Limit | Default | Past it |
|---|---|---|
| `peekaboot.tracing.max-spans-per-trace` | 500 | The oldest spans are dropped, and the trace carries a TRUNCATED badge |
| `peekaboot.tracing.max-logs-per-trace` | 500 | The oldest log lines are dropped |
| Stack trace lines, on a captured log line or a failed span | 1,000 | Cut, ending with a `... N lines omitted` marker |
| Span tag value, exception message or log message | 16,000 characters | Cut, ending with `... N characters omitted` |

{% include facts/trace-memory.md -%}
Lower the limits on a memory-constrained application, see
[Configuration]({{ '/docs/configuration/' | relative_url }}#memory-constrained).

### Traces across restarts {#persisted-traces}

With [`peekaboot.storage.enabled`]({{ '/docs/configuration/' | relative_url }}#peekabootstorage)
on, the default for a local run, and `peekaboot.storage.traces.enabled` left on, Peekaboot writes
every span, log line and completed request to the storage directory and restores them at the next
start. The [error digest]({{ '/docs/api/' | relative_url }}#error-digest) is kept on the same
switches. The files are listed under
[Configuration]({{ '/docs/configuration/' | relative_url }}#peekabootstorage).

| Setting | Default | Effect |
|---|---|---|
| `peekaboot.storage.traces.flush-interval` | one second | How often the files are written. A crash usually loses the last interval |
| `peekaboot.storage.traces.max-journal-size` | 64 MB | Past it, Peekaboot compacts the files |

Traces are restored in the background after a restart. A request that was still running when the
application stopped reads INTERRUPTED. One running instance writes a storage directory, see
[History is not saved although storage is on]({{ '/docs/troubleshooting/' | relative_url }}#second-instance).

### The SLOW badge and the Slow bucket {#slow-badge-vs-slow-bucket}

{% include screenshot.html name="dashboard-traces" %}

The SLOW badge on a row means the trace's duration, background work excluded, reached
`slow-trace-threshold-ms` (1000ms), the rule the Slow bucket admits by. A slow span inside a
quick request shows as that span's own SLOW or VERY_SLOW issue in the Spans tab. A trace with an
error shows the ERROR badge instead of SLOW.

## Limitations {#tracing-vs-distributed-tracing}

Peekaboot sees only the spans of the process it runs in. Two services that call each other
show two partial traces under the same trace id, on two dashboards. It keeps no history past
the limits above, and none past a restart while storage is off. It does not aggregate across
instances, and does not alert. The percentiles on
[Insights]({{ '/docs/insights/' | relative_url }}#percentiles-of-aggregates) are percentiles
of aggregates.

For tracing across services, retention or alerting, export to an OTLP backend such as
[Grafana Tempo](https://grafana.com/oss/tempo/) or [Jaeger](https://www.jaegertracing.io/)
next to Peekaboot.
