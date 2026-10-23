---
title: Traces
lead: The last 1,000 requests, jobs and messages your application handled, with their spans, SQL and logs, held in memory.
permalink: /docs/traces/
redirect_from:
  - /docs/tracing/
  - /docs/concepts/
---

Peekaboot keeps a copy of every span your application exports in an in-memory store. The
dashboard's Traces tab lists them, and the [dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }})
shows the trace of the page you are looking at.

The store is one more span exporter next to the ones you configured. An existing OTLP,
Zipkin or Jaeger pipeline keeps working unchanged. Peekaboot adds no exporter that sends data
out of the process, and it turns Micrometer's OTLP metrics export off.

## Requirements {#requirements}

- `peekaboot.enabled=true`. It defaults to true only for a [local
  run]({{ '/docs/configuration/' | relative_url }}#local-run).
- `peekaboot.tracing.enabled`, which defaults to `true`.
- A servlet web application. A WebFlux application records no traces.
- The OpenTelemetry SDK, which the starter brings. An application that uses the Brave bridge
  instead gets an empty Traces tab.

Queries appear for JDBC only. The starter adds `datasource-micrometer`, which instruments your
`DataSource` beans. If you instrument your `DataSource` yourself, exclude the starter's copy or
set `jdbc.datasource-proxy.enabled=false`. R2DBC is not instrumented.

## What gets recorded {#what-gets-captured}

Every span your application exports: HTTP requests, scheduled jobs, message consumers, and
the database queries and outbound calls they make.

Peekaboot sets `management.tracing.sampling.probability` to `1.0` (Spring Boot's default is
`0.1`). Your own setting wins, and Peekaboot sees only sampled spans. Sample at 10% and it
records 10%.

Requests under these path prefixes are never recorded: `/static/`, `/webjars/`,
`/peekaboot/`, `/error/`, and the management base path (`/actuator/` by default, following
`management.endpoints.web.base-path`). With the base path set to `/` there is no prefix to
exclude, and actuator requests are recorded like any other.

With the [dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}) on, each trace also holds
the request and response headers and parameters and the log lines written while handling it.
Without the toolbar, traces hold spans only.

## Spans Peekaboot adds {#spans-peekaboot-adds}

Peekaboot raises four observations of its own. They are ordinary Micrometer observations, so
every exporter you configured receives them too.

| Span | Around | Tags |
|---|---|---|
| `spring.handler` | The controller method | `handler.type`, `handler.name` |
| `spring.view.render` | View rendering, only when the handler resolved a view | `view.type`, `view.name` |
| `async task` (observation `peekaboot.async.task`) | A task run on one of Spring's task executors, see [background work](#background-work) | `peekaboot.async`, `peekaboot.async.thread` |
| `<Class>#<method>` (observation `peekaboot.event.listener`) | An event listener method, see [event listeners](#event-listeners) | `peekaboot.event.type`, `peekaboot.event.listener.class`, `peekaboot.event.listener.method` |

Spans opened inside the controller method, such as JDBC and HTTP client calls, nest under
`spring.handler`. `peekaboot.tracing.async=false` turns off the async span alone, and
`peekaboot.tracing.event-listeners=false` the listener spans. `peekaboot.tracing.enabled=false`
removes all four.

## Background work {#background-work}

Work handed to a Spring task executor, for example an `@Async` method, runs on another thread.
To see it inside the trace that started it, set:

```yaml
spring:
  task:
    execution:
      propagate-context: true
```

<div class="pk-callout pk-callout--warning" markdown="1">
**Peekaboot does not set `spring.task.execution.propagate-context`.** Spring Boot leaves it
off. Without it, Peekaboot records no `async task` span and no row is of type Async Task. The
queries and outbound calls a task makes become traces of their own, typed by the call, with
nothing linking them to the request that started them.
</div>

Peekaboot wraps tasks on executors that Spring Boot builds: the auto-configured
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
- Errors and queries in background work still count. An `@Async` method that throws fails
  its `async task` span and puts its trace in Errors, whether it returns `void` or a
  `Future`, and so does a task passed to `execute()`. Your `AsyncUncaughtExceptionHandler`
  still runs. A failing task passed to `submit()` fails its span too. Two paths are not
  covered and leave the span OK: `submitCompletable()`, and a `void` or `CompletableFuture`
  `@Async` method under `@EnableAsync(mode = AdviceMode.ASPECTJ)`.
- In the trace's Spans tab, the task starts collapsed and carries a background chip.

{% include screenshot.html name="trace-detail-async" %}

Each task is also listed as its own row of type Async Task, timed on its own. The row appears
when the task ends and goes to the top of the list, even if its trace is older. It links to the
trace that started it while that trace is still in the store. One trace can therefore produce
several rows.
{: #async-rows}

Every async span is named `async task`. To see which method ran, put
`@Observed(contextualName = "...")` on it. Its span then appears under `async task`.

`@Scheduled` runs get no async span and keep the Scheduled type.

## Event listeners {#event-listeners}

Each call of an `@EventListener` or `@TransactionalEventListener` method gets a span named after
the method, such as `OrderConfirmationListener#onOrderPlaced`. It nests under the work that
published the event. A transactional listener's span starts when the listener runs, after the
commit, and a listener whose `condition` rejects the event gets none.

A listener gets a span only inside a trace. One called with no trace in scope, on
`ApplicationReadyEvent` for example, gets none. An `@Async` listener runs on an executor thread,
so it needs `spring.task.execution.propagate-context`, like any [background
work](#background-work). Its span then sits inside the `async task` span.

These listeners get no span:

- Listeners in `org.springframework.` packages.
- Methods or classes you annotate with `@Observed`. Your own span already covers them.
- Static listener methods.
- Classes a proxy would break: final or sealed classes, classes with only private constructors,
  a private listener method, or any non-private final instance method. Kotlin classes are final
  by default. Peekaboot logs each one it skips at debug.

Peekaboot observes a listener through a proxy around its bean. Calling the method directly,
without an event, also produces a span. `getClass()` on the injected bean returns the proxy's
class; use `ClassUtils.getUserClass` for the declared one.

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

Spans shows the span tree with each span's kind, tags and duration, nested as they ran. Click
a span's name for its details: kind, a copyable span id, the full tags, and the error class and
message where the span failed. A query span carries a "1 query" button that opens the
statement with its row count. A span that logged carries an "N logs" button that opens its log
lines, with stack traces folded as on the Logs tab. Both panels open in place.

{% include screenshot.html name="trace-detail-queries" %}

Queries lists the SQL the trace ran, one row per statement, with duration and row count where
the instrumentation records it. A query at or above
`peekaboot.ui.tracing.slow-query-threshold-ms` (default 50ms) is marked SLOW. A JDBC batch is
one row with its statements joined. A query recorded without statement text is listed without
SQL.

A statement shows as captured, highlighted. With Hibernate on the classpath, Formatted lays it
out the way Hibernate's `format_sql` log does. Its bind parameters are listed under it, one list
per batch entry, masked like the SQL. Substitute parameters puts them in place of the `?`
placeholders when there is one set and it fits. The copy button copies the SQL as shown. A bind
value over 1,000 characters is cut with a comment like `/* 7 characters omitted */`. A batch
records at most 100 parameter sets, and a note after the last one says how many were left
out, such as "5 parameter sets omitted".

Logs lists the log lines written while handling the request, filterable by text, level and
span. Request shows the method, path, query string, status, duration, controller method,
parameters, and request and response headers. Logs and Request are filled only while the dev
toolbar is on. See [Dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}) for what is masked
and what is not.

A query or a log line jumps back to its span in the tree; a span's own query and logs sit
beside its attributes instead of linking out to the other tabs.

## Status and issues {#trace-status}

A trace is OK, or HAS_ERRORS when any span ended with an error. Slowness is not a status. It
shows as span issues and the Slow bucket.

### Issues {#issues}

An issue marks one span in the tree. The thresholds live under `peekaboot.ui.tracing`, see
[Configuration]({{ '/docs/configuration/' | relative_url }}#peekabootuitracing).

| Issue | Raised when | Property (default) | Severity |
|---|---|---|---|
| VERY_SLOW | The span's own duration reaches the threshold | `very-slow-span-threshold-ms` (500) | Error |
| SLOW | The span's own duration reaches the threshold, and it is not VERY_SLOW | `slow-span-threshold-ms` (100) | Warning |
| SLOW_QUERY | A query's duration reaches the threshold | `slow-query-threshold-ms` (50) | Warning |

"Reaches" means at or above the threshold.

## Buckets, limits and memory {#the-three-buckets}

Every trace is in All. A trace that qualifies is also in Errors, Slow, or both.

| Bucket | Holds | Size property (default) |
|---|---|---|
| All | Every trace | `peekaboot.tracing.max-traces` (1000) |
| Errors | Traces with an errored span or an `ERROR` log line | `peekaboot.tracing.max-error-traces` (100) |
| Slow | Traces whose duration, [background work](#background-work) excluded, reaches `peekaboot.tracing.slow-trace-threshold-ms` (1000) | `peekaboot.tracing.max-slow-traces` (100) |

Error log lines are captured only while the dev toolbar is on. Without it, Errors admits on
errored spans alone.

When a bucket is full, it drops the trace it admitted first. The buckets evict independently,
so a trace can stay under Errors or Slow after it has left All. Nothing expires on a timer,
and everything is gone at restart.

One trace keeps at most `peekaboot.tracing.max-spans-per-trace` spans (500) and
`peekaboot.tracing.max-logs-per-trace` log lines (500). Past either limit the oldest are
dropped. A trace that lost spans carries a TRUNCATED badge. A stack trace in a captured log
line is cut at 1,000 lines and ends with a `... N lines omitted` marker. A `StackOverflowError`
is the usual case. The error page shows the whole trace.

In the worst case the store holds 1,000 traces in All plus up to 200 that only Errors or Slow
still keep, each with 500 spans and 500 log lines: about 1.2 million entries, and each log line
can carry a stack trace of up to 1,000 lines. Lower the limits on a memory-constrained
application, see [Configuration]({{ '/docs/configuration/' | relative_url }}#memory-constrained).

### The SLOW badge and the Slow bucket {#slow-badge-vs-slow-bucket}

{% include screenshot.html name="dashboard-traces" alt="The Traces tab with a Slow bucket count lower than the number of rows carrying a SLOW badge" %}

The SLOW badge on a row means one span in the trace reached `slow-span-threshold-ms` (100ms).
The Slow bucket counts traces whose duration, background work excluded, reached
`slow-trace-threshold-ms` (1000ms), so many more rows carry the badge than the bucket holds. A
trace with an error shows the ERROR badge instead of SLOW, so counting SLOW badges misses slow
traces that also failed.

## Limitations {#tracing-vs-distributed-tracing}

Peekaboot sees only the spans of the process it runs in. Two services that call each other
show two partial traces under the same trace id, on two dashboards. It reads the W3C
`traceparent` header and never changes it, so propagation works as [Spring Boot's tracing
support](https://docs.spring.io/spring-boot/reference/actuator/tracing.html) configures it.

It keeps no history past the limits above or past a restart, does not aggregate across
instances, and does not alert. The percentiles on
[Insights]({{ '/docs/insights/' | relative_url }}#percentiles-of-aggregates) are percentiles
of aggregates.

For tracing across services, retention or alerting, export to an OTLP backend such as
[Grafana Tempo](https://grafana.com/oss/tempo/) or [Jaeger](https://www.jaegertracing.io/)
next to Peekaboot.
