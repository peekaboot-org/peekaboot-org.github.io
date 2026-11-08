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

An agent reads the same traces over HTTP. [Agents, debug a
500]({{ '/docs/agents/' | relative_url }}#debug-a-500) goes from a failing request to its stack
trace.

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

Requests to `/peekaboot/` are not observed at all. Your other exporters and the
`http.server.requests` metrics do not see them either.

Each trace also holds the request and response headers and parameters and the log lines
written while handling it. Log lines written outside any trace, later in startup or on a
thread without the trace context, are kept as well, the newest `peekaboot.tracing.max-untraced-logs`
(1,000), for the [log search]({{ '/docs/api/' | relative_url }}#log-search).

## Spans Peekaboot adds {#spans-peekaboot-adds}

Peekaboot raises four observations of its own. They are ordinary Micrometer observations, so
every exporter you configured receives them too.

| Span | Around | Tags |
|---|---|---|
| `<Class>.<method>` (observation `spring.handler`) | The controller method | `handler.type`, `handler.name` |
| `<view name>` (observation `spring.view.render`) | View rendering, only when the handler resolved a view | `view.type`, `view.name` |
| `async task` (observation `peekaboot.async.task`) | A task run on one of Spring's task executors, see [background work](#background-work) | `peekaboot.async`, `peekaboot.async.thread` |
| `<Class>#<method>` (observation `peekaboot.event.listener`) | An event listener method, see [event listeners](#event-listeners) | `peekaboot.event.type`, `peekaboot.event.listener.class`, `peekaboot.event.listener.method` |

Spans opened inside the controller method, such as JDBC and HTTP client calls, nest under
the handler span. `peekaboot.tracing.async=false` turns off the async span alone, and
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
a span's name for its details: kind, a copyable span id, its issues and the full tags. Where the span
failed, they also show the exception's class, message and stack trace, folded as on the Logs
tab. A query span carries a "1 query" button that opens the statement with its row count. A span that
logged carries an "N logs" button that opens its log lines, with stack traces folded as on the
Logs tab. Both panels open in place.

The header names the trace's cause when it failed: the exception's class and message, the
application frame it came from, and a link to its span. Above the tree, Most self time lists up
to three spans that spent the longest on their own work, each linking to its row. A span whose
children covered part of its time shows its self time after its duration and share, such as
`1.20s · 80% · self 300ms`.

{% include screenshot.html name="trace-detail-queries" %}

Queries lists the SQL the trace ran, one row per statement, with duration and row count where
the instrumentation records it. A query at or above
`peekaboot.tracing.slow-query-threshold-ms` (default 50ms) is marked SLOW. A JDBC batch is
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
parameters, and request and response headers. See [Dev
toolbar]({{ '/docs/dev-toolbar/' | relative_url }}#request-and-response-detail) for what is masked
and what is not.

A query or a log line jumps back to its span in the tree; a span's own query and logs sit
beside its attributes instead of linking out to the other tabs.

## Outcome and issues {#trace-status}

A trace's outcome is OK, ERROR, IN PROGRESS or INTERRUPTED. INTERRUPTED is a trace restored
from an earlier run that stopped before the trace's root arrived. ERROR means a span failed, a
server span answered with a 5xx, or a line was logged at `ERROR`. That is also what puts a trace
in Errors. A 4xx answer is a CLIENT_ERROR issue and leaves the outcome OK.

A 4xx stays OK however it was answered, also where a view rendered an exception for it. That
view is the page [`peekaboot.error-page.override`]({{ '/docs/error-page/' | relative_url }}#override)
renders for an HTML request that ends in an exception, or one your own `@ExceptionHandler`
renders. For a 4xx, Spring clears the exception once the view has rendered, so the request's
server span does not record it. Spring's own `400`, `405` and the `404` for an unknown path read
OK with a CLIENT_ERROR issue and stay out of Errors and the error digest. A view that answers
with a 5xx still fails the trace through its HTTP status. Where Peekaboot's page answers an
exception with a 5xx, it also fails the request's server span with that exception.
{: #exception-views}

A trace whose root span has not arrived yet shows IN PROGRESS in its detail, with the spans that
have arrived. The request may still be running.

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

REPEATED_QUERY finds the N+1 pattern. It compares statements with their string and number
literals replaced by `?` and their whitespace collapsed. A literal it leaves as written, such as
`TRUE` or a hex number, keeps two runs apart. The queries count toward the span they ran
under. `datasource-micrometer` records a JDBC connection span as their sibling, so a loop's
queries stay under the loop's span. CLIENT_ERROR is raised on the root server span only, the
request the trace answers.

The Spans tab colours a span's duration by its SLOW, VERY_SLOW and SLOW_QUERY issues, and marks
REPEATED_QUERY and CLIENT_ERROR with a badge on their span. A type gets one badge however many
statements the span repeats, and the badge's tooltip lists each issue. A span's details list each
of its issues with its sentence.

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

One trace keeps at most `peekaboot.tracing.max-spans-per-trace` spans (500) and
`peekaboot.tracing.max-logs-per-trace` log lines (500). Past either limit the oldest are
dropped. A trace that lost spans carries a TRUNCATED badge. A stack trace in a captured log
line or on a failed span is cut at 1,000 lines and ends with a `... N lines omitted` marker. A
`StackOverflowError` is the usual case. The error page shows the whole trace.

A span's stack trace is also cut by
`management.opentelemetry.tracing.limits.max-attribute-value-length`, if you set it. The
OpenTelemetry SDK then shortens it to that many characters. Spring Boot sets no limit.

In the worst case the store holds 1,000 traces in All plus up to 200 that only Errors or Slow
still keep, each with 500 spans and 500 log lines: about 1.2 million entries, plus 1,000 log
lines written outside any trace, and each log line and each failed span can carry a stack trace
of up to 1,000 lines. Lower the limits on a memory-constrained application, see
[Configuration]({{ '/docs/configuration/' | relative_url }}#memory-constrained).

With [traces kept across restarts](#persisted-traces), folding the journal replays the files
into a second store, so while a fold runs the peak is about twice that.

### Traces across restarts {#persisted-traces}

With [`peekaboot.storage.enabled`]({{ '/docs/configuration/' | relative_url }}#peekabootstorage)
on, the default for a local run, and `peekaboot.storage.traces.enabled` left on, every span, log
line and completed request the store takes is appended to `traces.journal.jsonl` in the storage
directory. The [error digest]({{ '/docs/api/' | relative_url }}#error-digest) is kept beside it
in `errors.jsonl`, on the same switches. Each running instance needs its own storage directory. Two instances on one directory
restore each other's traces, and each starts its journal afresh over the other's, so the lines the
other wrote since its last fold are lost.

The journal is handed to the operating system every `peekaboot.storage.traces.flush-interval`,
one second by default, without an fsync. A crash usually loses the last interval, and everything
since the start while the application is still starting or restoring its traces.

At shutdown the spans still waiting in OpenTelemetry's batch are exported before the journal
closes. OpenTelemetry waits at most 10 seconds for that, and Spring Boot gives every span exporter
the same batch. An exporter of your own that takes longer, such as an OTLP exporter whose collector
does not answer, can hold Peekaboot's last spans past that wait. Those spans miss the journal, and
a request among them reads INTERRUPTED after the restart.

At the next start Peekaboot replays the files into the store in the background. For the first
moments the Traces tab and the API show the traces restored so far, and the last run's cut-off
traces read IN PROGRESS until the restore ends. The summaries and issues are worked out again by
the version now running.

The snapshot lists each bucket's traces in order, so with unchanged bucket limits All, Errors
and Slow come back exactly as the last fold saw them. Later inputs replay in the order the
journal wrote them, so two traces that arrived at the same moment may come back swapped, and a
full bucket may keep the other one of the two.

A request that was still running when the application stopped reads INTERRUPTED, since its root
never arrives. If it holds any span it does not list, see the [trace
list]({{ '/docs/api/' | relative_url }}#trace-list). Every trace names the run it came from, the
`run` of [its summary]({{ '/docs/api/' | relative_url }}#summary-fields).

The journal is folded into `traces.snapshot.jsonl` at startup, at shutdown and once it passes
`peekaboot.storage.traces.max-journal-size` (64 MB). Files in another format, which an older or
newer Peekaboot may write, or with a damaged header, are deleted at startup with one line in the
log. What is stored unmasked is under [Security]({{ '/docs/security/' | relative_url }}#what-peekaboot-writes-to-disk).

### The SLOW badge and the Slow bucket {#slow-badge-vs-slow-bucket}

{% include screenshot.html name="dashboard-traces" %}

The SLOW badge on a row means the trace's duration, background work excluded, reached
`slow-trace-threshold-ms` (1000ms). That is the rule the Slow bucket admits by. On a row for
[background work](#async-rows) it judges the task's own duration, so that row can show SLOW
while its trace is outside Slow. A slow span
inside a quick request shows as that span's own SLOW or VERY_SLOW issue in the Spans tab. A
trace with an error shows the ERROR badge instead of SLOW. A row for an
[interrupted](#persisted-traces) trace also shows INTERRUPTED.

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
