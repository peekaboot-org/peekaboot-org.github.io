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

These request paths are never recorded, even with a `traceparent` header, such as a probe from a
monitor that traces its own calls:

- `/static/`, `/webjars/` and `/error/`.
- `/peekaboot/`. These requests are not observed at all: your other exporters and the
  `http.server.requests` metrics do not see them either.
- The management base path, `/actuator/` by default, following
  `management.endpoints.web.base-path`. With the base path set to `/` there is no prefix to
  exclude, and actuator requests are recorded like any other.

Each trace also holds the request and response headers and parameters and the log lines
written while handling it. Log lines written outside any trace, later in startup or on a
thread without the trace context, are kept as well, the newest `peekaboot.tracing.max-untraced-logs`
(1,000), for the [log search]({{ '/docs/api/' | relative_url }}#log-search).

## Spans Peekaboot adds {#spans-peekaboot-adds}

Peekaboot raises four Micrometer observations of its own. Every exporter you configured receives
these spans too.

| Span | Around |
|---|---|
| `<Class>.<method>` (observation `spring.handler`) | The controller method |
| `<view name>` (observation `spring.view.render`) | View rendering, only when the handler resolved a view |
| `async task` (observation `peekaboot.async.task`) | A task run on one of Spring's task executors, see [background work](#background-work) |
| `<Class>#<method>` (observation `peekaboot.event.listener`) | An event listener method, see [event listeners](#event-listeners) |

Spans opened inside the controller method, such as JDBC and HTTP client calls, nest under
the handler span. `peekaboot.tracing.async=false` turns off the async span alone, and
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

Tasks on executors that Spring Boot builds get the span: the auto-configured
`applicationTaskExecutor`, and any executor you create from Boot's
`ThreadPoolTaskExecutorBuilder` or `SimpleAsyncTaskExecutorBuilder`. Declaring an `Executor`
bean of your own makes Boot skip `applicationTaskExecutor`. Set
`spring.task.execution.mode=force` to keep it.

With context propagation on:

- Each task gets an `async task` span inside the trace that submitted it. A task submitted
  with no trace in scope gets none.
- The request's duration and the [Slow bucket](#the-three-buckets) check leave the
  background work out. A request that returns in 50ms reports 50ms, however long its task
  runs.
- Errors and queries in background work still count, see the table below.

A task that throws fails its `async task` span and puts its trace in Errors, except where the
table says the span stays OK.

| Task | Failure on the span |
|---|---|
| `@Async` method returning `void` or a `Future` | Recorded. Your `AsyncUncaughtExceptionHandler` still runs |
| Task passed to `execute()` | Recorded |
| Task passed to `submit()` | Recorded |
| Task passed to `submitCompletable()` | Not covered, the span stays OK |
| `void` or `CompletableFuture` `@Async` method under `@EnableAsync(mode = AdviceMode.ASPECTJ)` | Not covered, the span stays OK |

{% include screenshot.html name="trace-detail-async" %}

Each task is also listed as its own row of type Async Task, timed on its own. It links to the
trace that started it while that trace is still in the store. One trace can therefore produce
several rows.
{: #async-rows}

Every async span is named `async task`. To see which method ran, put
`@Observed(contextualName = "...")` on it. Its span then appears under `async task`.

`@Scheduled` runs get no async span and keep the Scheduled type.

## Event listeners {#event-listeners}

Each call of an `@EventListener` or `@TransactionalEventListener` method gets a span named after
the method, such as `OrderConfirmationListener#onOrderPlaced`. It nests under the work that
published the event. A listener whose `condition` rejects the event gets none.

A listener gets a span only inside a trace. One called with no trace in scope, on
`ApplicationReadyEvent` for example, gets none. An `@Async` listener runs on an executor thread,
so it needs `spring.task.execution.propagate-context`, like any [background
work](#background-work). Its span then sits inside the `async task` span.

Listeners in `org.springframework.` packages, methods or classes you annotate with `@Observed`,
static listener methods and classes a proxy would break get no span. Those are final or sealed
classes (Kotlin classes are final by default), classes with only private constructors, a
private listener method, and any non-private final instance method. Peekaboot logs each one it
skips at debug.

Listener beans become proxies, so `getClass()` on the injected bean returns the proxy class. Use
`ClassUtils.getUserClass` for the declared one. Calling a listener method directly, without an
event, also produces a span.

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

Only `@Scheduled` methods fired by Spring's scheduler show as Scheduled. Quartz, a plain
`ScheduledExecutorService` or another timer shows as Unknown or by whatever else its tags
match.

Maintenance traces arrive often enough to drown everything else. The Traces tab excludes
them until you untick Maintenance under Excluded. Over the HTTP API,
[`rootActionType=*`]({{ '/docs/api/' | relative_url }}#endpoints) returns every type.
{: #maintenance-traces-hidden}

## The trace detail {#the-trace-view}

Click a row on the Traces tab, or click the dev toolbar, to open a trace's detail. It has four
tabs and opens on Spans.

{% include screenshot.html name="trace-detail" %}

**Spans** shows the span tree, nested as the spans ran.

- Each span shows its kind, tags and duration. A span whose children covered part of its time
  also shows its self time, such as `1.20s · 80% · self 300ms`.
- Click a span's name for its issues and full tags. Where the span failed, it also shows the
  exception's class, message and stack trace, folded as on the Logs tab.
- A query span opens its statement with its row count. A span that logged opens its log lines.
- When the trace failed, the header names its cause: the exception's class and message, the
  application frame it came from, and a link to its span.
- Most self time, above the tree, lists up to three spans that spent the longest on their own
  work, each linking to its row.

{% include screenshot.html name="trace-detail-queries" %}

**Queries** lists the SQL the trace ran, one row per statement.

- Each row shows its duration and row count where the instrumentation records them. A query at
  or above `peekaboot.tracing.slow-query-threshold-ms` (default 50ms) is marked SLOW.
- A JDBC batch is one row with its statements joined. A query recorded without statement text
  is listed without SQL.
- With Hibernate on the classpath, Formatted lays the statement out the way Hibernate's
  `format_sql` log does.
- Bind parameters are listed under the statement, one list per batch entry, masked like the SQL.
  Substitute parameters puts them in place of the `?` placeholders when there is one set and it
  fits.

Bind parameters are limited per statement:

| Limit | Value | Past it |
|---|---|---|
| One bind value | 1,000 characters | Cut, with a comment like `/* 7 characters omitted */` |
| Parameter sets | 100 | Later sets are left out, and a note after the last one says how many, such as "5 parameter sets omitted" |
| Bind-value characters | 16,000 | A batch leaves out its later sets, with the same note. A single set ends with a comment like `/* 12 parameters omitted */` |

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
| IN PROGRESS | The root span has not arrived yet. The detail shows the spans that have. The request may still be running |
| INTERRUPTED | A trace restored from an earlier run that stopped before the trace's root arrived |

A 4xx stays OK also where a view rendered an exception for it. That view is the page [`peekaboot.error-page.override`]({{ '/docs/error-page/' | relative_url }}#override)
renders for an HTML request that ends in an exception, or one your own `@ExceptionHandler`
renders. Spring's own `400`, `405` and the `404` for an unknown path read OK with a
CLIENT_ERROR issue and stay out of Errors and the error digest. A view that answers with a 5xx
still fails the trace through its HTTP status. Where Peekaboot's page answers an exception with
a 5xx, it also fails the request's server span and its handler span with that exception, so the
cause names the handler span.
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
count as the same. A literal such as `TRUE` or a hex number keeps two runs apart. CLIENT_ERROR is
raised on the root server span only, the request the trace answers.

The Spans tab colours a span's duration by its SLOW, VERY_SLOW and SLOW_QUERY issues, and marks
REPEATED_QUERY and CLIENT_ERROR with a badge on their span.

## Buckets, limits and memory {#the-three-buckets}

Every trace is in All. A trace that qualifies is also in Errors, Slow, or both.

| Bucket | Holds | Size property (default) |
|---|---|---|
| All | Every trace | `peekaboot.tracing.max-traces` (1000) |
| Errors | Traces with an errored span, a 5xx answer or an `ERROR` log line | `peekaboot.tracing.max-error-traces` (100) |
| Slow | Traces whose duration, [background work](#background-work) excluded, reaches `peekaboot.tracing.slow-trace-threshold-ms` (1000) | `peekaboot.tracing.max-slow-traces` (100) |

When a bucket is full, it drops the trace it admitted first. The buckets evict independently,
so a trace can stay under Errors or Slow after it has left All. Nothing expires on a timer.
With storage on, the buckets survive a restart, see [below](#persisted-traces).

One noisy failure can fill Errors and push every other failure out. The [error
digest]({{ '/docs/api/' | relative_url }}#error-digest) keeps counting every failure, one entry
per exception class, route and application frame, after its traces are gone.

One trace is limited in size:

| Limit | Default | Past it |
|---|---|---|
| `peekaboot.tracing.max-spans-per-trace` | 500 | The oldest spans are dropped, and the trace carries a TRUNCATED badge |
| `peekaboot.tracing.max-logs-per-trace` | 500 | The oldest log lines are dropped |
| Stack trace lines, on a captured log line or a failed span | 1,000 | Cut, ending with a `... N lines omitted` marker. A `StackOverflowError` is the usual case. The error page shows the whole trace |
| Span tag value, exception message or log message | 16,000 characters | Cut, ending with `... N characters omitted` |
| `management.opentelemetry.tracing.limits.max-attribute-value-length` | not set by Spring Boot | If you set it, the OpenTelemetry SDK shortens a span's stack trace to that many characters |

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
| `peekaboot.storage.traces.flush-interval` | one second | How often the files are written. A crash usually loses the last interval, and everything since the start while the application is still starting or restoring its traces |
| `peekaboot.storage.traces.max-journal-size` | 64 MB | Past it, Peekaboot compacts the files |

After a restart:

- Restored traces appear progressively. The Traces tab and the API show the ones restored so
  far, and the last run's cut-off traces read IN PROGRESS until the restore ends.
- A request that was still running when the application stopped reads INTERRUPTED. If it holds
  any span it does not list, see the [trace list]({{ '/docs/api/' | relative_url }}#trace-list).
- Every trace names the run it came from, the `run` of
  [its summary]({{ '/docs/api/' | relative_url }}#summary-fields).
- Files written by another Peekaboot version, or with a damaged header, are deleted at startup
  with one line in the log.

One running instance writes a storage directory. A second instance that starts on it keeps its
traces and its error digest in memory and restores none from the files. See
[History is not saved although storage is on]({{ '/docs/troubleshooting/' | relative_url }}#second-instance).

At shutdown OpenTelemetry waits at most 10 seconds for pending spans. An exporter of your own
that takes longer, such as an OTLP exporter whose collector does not answer, can cost Peekaboot's
last spans. A request among them reads INTERRUPTED after the restart.

### The SLOW badge and the Slow bucket {#slow-badge-vs-slow-bucket}

{% include screenshot.html name="dashboard-traces" %}

The SLOW badge on a row means the trace's duration, background work excluded, reached
`slow-trace-threshold-ms` (1000ms), the rule the Slow bucket admits by. On a row for
[background work](#async-rows) it judges the task's own duration, so that row can show SLOW
while its trace is outside Slow. A slow span inside a quick request shows as that span's own SLOW
or VERY_SLOW issue in the Spans tab. A trace with an error shows the ERROR badge instead of SLOW,
and a row for an [interrupted](#persisted-traces) trace also shows INTERRUPTED.

## Limitations {#tracing-vs-distributed-tracing}

Peekaboot sees only the spans of the process it runs in. Two services that call each other
show two partial traces under the same trace id, on two dashboards. It reads the W3C
`traceparent` header and never changes it, so propagation works as [Spring Boot's tracing
support](https://docs.spring.io/spring-boot/reference/actuator/tracing.html) configures it.

It keeps no history past the limits above, and none past a restart while storage is off. It
does not aggregate across instances, and does not alert. The percentiles on
[Insights]({{ '/docs/insights/' | relative_url }}#percentiles-of-aggregates) are percentiles
of aggregates.

For tracing across services, retention or alerting, export to an OTLP backend such as
[Grafana Tempo](https://grafana.com/oss/tempo/) or [Jaeger](https://www.jaegertracing.io/)
next to Peekaboot.
