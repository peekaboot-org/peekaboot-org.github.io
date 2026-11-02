---
title: HTTP API
lead: The JSON endpoints under /peekaboot/api that the dashboard and the dev toolbar read.
permalink: /docs/api/
---

<div class="pk-callout pk-callout--warning" markdown="1">
On a local run these endpoints need no authentication. Read [Security, securing the
dashboard]({{ '/docs/security/' | relative_url }}#securing-the-dashboard) before you expose
them anywhere else.
</div>

## Conventions {#conventions}

- Optional fields are always present. A missing value is `null`, never an absent key.
- Every endpoint below answers with `Cache-Control: no-store` and
  `X-Content-Type-Options: nosniff`. That includes the event stream and the errors under
  [Errors](#errors), the guard's `401` among them.
- Peekaboot serialises its responses with its own JSON converter. Your `spring.jackson.*`
  settings do not change them, and Peekaboot does not change your application's JSON.
- All endpoints are `GET`.
- The errors under [Errors](#errors) answer with a problem body.
- A point in time Peekaboot records is an ISO-8601 string in UTC, such as
  `2026-10-23T10:15:30.123456Z`, with as many fractional digits as the clock gave.
  `server.currentTime` keeps the JVM's own offset. `application.git.commit.time` is the string
  Actuator reports. Only the Insights series positions are epoch milliseconds, named
  `...EpochMs`. Any other field ending in `Ms` is a duration.

## Endpoints {#endpoints}

| Endpoint | Parameters | Status codes |
|---|---|---|
| [`/peekaboot/api/features`](#features) | none | `200` |
| [`/peekaboot/api/actuator/all/insights`](#what-insights-adds) | `locale`, `unmask` | `200`, `400` |
| [`/peekaboot/api/metrics`](#meters) | none | `200` |
| [`/peekaboot/api/traces`](#trace-list) | `limit`, `cursor`, `bucket`, `rootActionType`, `rootOperation`, `route`, `path`, `statusCode`, `outcome`, `minDurationMs`, `since`, `until`, `view` | `200`, `400` |
| [`/peekaboot/api/traces/{traceId}`](#single-trace) | none | `200`, `404` |
| [`/peekaboot/api/logs`](#log-search) | `level`, `q`, `logger`, `traceId`, `since`, `until`, `limit`, `cursor` | `200`, `400` |
| [`/peekaboot/api/routes`](#routes) | none | `200` |
| [`/peekaboot/api/insights/config`](#the-insights-endpoints) | none | `200`, `404` when Insights is off |
| [`/peekaboot/api/insights/data`](#the-insights-endpoints) | `level` (required) | `200`, `400`, `404` when Insights is off |
| [`/peekaboot/api/insights/stream`](#the-insights-endpoints) | none | `200` (Server-Sent Events), `503`, `404` when Insights is off |
| [`/peekaboot/api/lifecycle/events`](#restart-history) | none | `200`, `404` when lifecycle is off |
| [`/peekaboot/api/lifecycle/runs`](#restart-history) | none | `200`, `404` when lifecycle is off |

Where Peekaboot's guard is armed, every endpoint can also answer `401`. See
[Security, Peekaboot's guard]({{ '/docs/security/' | relative_url }}#peekaboots-guard).

`/peekaboot` and `/peekaboot/` redirect to the dashboard at
`/peekaboot/ui/dashboard/index.html`. See [The
dashboard]({{ '/docs/dashboard/' | relative_url }}).

## Errors {#errors}

The errors below answer with an RFC 9457 problem body, served as `application/problem+json`:

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Unknown bucket 'eror'. Accepted: ALL, ERRORS, SLOW.",
  "parameter": "bucket"
}
```

`type` is always `about:blank` and `title` is the status's own phrase. `detail` says what was
wrong with this request. `parameter` names the request parameter at fault, and is `null` where
no single parameter is.

| Status | When | `parameter` |
|---|---|---|
| `400` | An unknown `bucket`, `rootActionType`, `view` or `outcome` value, or an unknown log search `level`. `detail` lists the accepted values. | The parameter |
| `400` | A value that is not a number or boolean where one is expected, such as `limit=abc` or `unmask=maybe`, or a number outside its range, such as `limit=0`. `detail` gives the range. | The parameter |
| `400` | A `since` or `until` that is no ISO-8601 instant, or an `until` not later than `since`. | The parameter |
| `400` | A `cursor` the endpoint did not hand out, the other listing's `next` among them. | `cursor` |
| `400` | A trace list or log search parameter sent more than once, such as `limit=1&limit=2`. | The parameter |
| `400` | A missing `level`, or one outside the configured levels. `detail` gives the accepted range. | `level` |
| `404` | The store does not hold the [trace](#single-trace). | `null` |
| `401` | [Peekaboot's guard]({{ '/docs/security/' | relative_url }}#peekaboots-guard) refused the request. | `null` |
| `503` | The [insights stream](#the-insights-endpoints) already has 32 subscribers. | `null` |

The guard's `401` keeps its challenge, `WWW-Authenticate: Basic realm="Peekaboot",
charset="UTF-8"`. Where your own Spring Security refuses a request first, the `401` is Spring
Security's, without Peekaboot's realm or body.

A request your application includes into the dashboard gets nothing from it. An include cannot
set the status, so the including response keeps its own.

Any other error, such as the `404` while Insights or lifecycle is off, a `405` or an unexpected
`500`, gets your application's usual error response.

## Features {#features}

`GET /peekaboot/api/features` says which parts of Peekaboot are active and which thresholds
it uses. The dashboard shows or hides its tabs from it.

| Field | Meaning |
|---|---|
| `tracing` | The trace store exists (`peekaboot.tracing.enabled`). |
| `tracingSpansPossible` | An OpenTelemetry SDK is on the classpath to feed the store. `false` means no span can ever arrive. `true` does not promise that one will, since your sampling settings still apply. Ignore it while `tracing` is `false`. |
| `metrics` | A `MeterRegistry` bean exists. Drives the Meters tab. |
| `unmaskingEnabled` | `peekaboot.unmasking.enabled` is on. The "Show secrets" toggle depends on it. |
| `insights` | The Insights endpoints exist. |
| `lifecycle` | The `/peekaboot/api/lifecycle/**` endpoints exist (`peekaboot.lifecycle.enabled`). Drives the Lifecycle tab. |
| `slowSpanThresholdMs`, `verySlowSpanThresholdMs`, `slowQueryThresholdMs` | The effective thresholds from [`peekaboot.tracing`]({{ '/docs/configuration/' | relative_url }}#issue-thresholds). |
| `maskLiteral` | The string masked values are replaced with, `******`. |

## Environment and configuration {#what-insights-adds}

`GET /peekaboot/api/actuator/all/insights` returns what the Overview, Environment, Config,
Loggers, Flyway, Liquibase and Scheduled Tasks tabs show:
`{application, runtime, dataSources, health, environment, loggers, flyway, liquibase, config,
scheduledTasks, server}`.

It works without any Actuator endpoint exposed. `management.endpoints.*` exposure settings
and the `show-values` and `show-details` settings have no effect on it. A source that is
missing (no Flyway, say) or fails leaves the rest of the response intact.

### The `locale` parameter {#the-locale-parameter}

`locale` is a language tag such as `de-DE`. `de_DE` works too. Omitted or blank means English.

It changes only the cron descriptions of scheduled tasks and the display name of the server's
default locale. The dashboard sends `en-US`, `de-DE`, `fr-FR` or `es-ES`; see
[The dashboard, the header]({{ '/docs/dashboard/' | relative_url }}#the-header).

### The `unmask` parameter {#the-unmask-parameter}

`unmask=true` asks for real values in place of masked ones. It works only with the server's
own opt-in. See [Security, two opt-ins before a real value is
shown]({{ '/docs/security/' | relative_url }}#masking-opt-ins).

### Scheduled tasks {#scheduled-tasks}

Each task is `{target, type, schedule, scheduleDescription, intervalMs, lastExecution,
lastStatus, lastException, nextExecution}`. `type` is `CRON`, `FIXED_DELAY` or `FIXED_RATE`.
`schedule` holds the cron expression and is `null` for fixed-rate and fixed-delay tasks, which
carry `intervalMs` instead.

## Meters {#meters}

`GET /peekaboot/api/metrics` returns every meter in the registry, grouped by name:

```
{metrics: [{name, description, baseUnit, type,
            measurements: [{tags, statistics: [{name, value}]}]}]}
```

Tag values that look like secrets are masked. Without a `MeterRegistry` the response is
`{metrics: []}`.

## Trace list {#trace-list}

`GET /peekaboot/api/traces` returns the newest traces first.

| Parameter | Values | Default | Invalid value |
|---|---|---|---|
| `limit` | 1 to 10000 | `100` | `400`, see [Errors](#errors). |
| `cursor` | The `next` of an earlier response | none, the first page | `400` |
| `bucket` | `all`, `errors`, `slow`, any case | `all` | `400`, see [Errors](#errors). |
| `rootActionType` | Comma-separated [root action types]({{ '/docs/traces/' | relative_url }}#root-action-type), any case, or `*` alone | Every type except `MAINTENANCE` | An unknown name, an empty entry or `*` among names: `400`. |
| `rootOperation` | Part of the name of the row's root span, any case | none | none |
| `route` | The request's route as `summary.request.route` shows it, such as `/persons/{id}`, exactly | none | none |
| `path` | The start of the request path, as written | none | none |
| `statusCode` | `100` to `599`, exactly | none | `400` |
| `outcome` | `OK`, `ERROR` or `IN_PROGRESS`, any case | none | `400` |
| `minDurationMs` | `0` or more. Lists rows whose `durationMs` is at least this. | none | `400` |
| `since`, `until` | ISO-8601 instants, such as `2026-11-01T10:15:30Z` | none | Not an instant, or an `until` not later than `since`: `400`. |
| `view` | `summary` or `full`, any case | `summary` | `400`, see [Errors](#errors). |

`rootActionType=*` includes `MAINTENANCE`.

A `rootOperation` with more than two dot-separated segments also matches on its last two. So
`com.acme.ReportJob.run` finds a scheduled task span named `reportJob.run`.

Filters combine. A row lists when it matches every one. A parameter sent empty counts as not
sent. `since` and `until` bound the row's `summary.startTime`, `since` in and `until` out. A
trace with no start time yet is outside any window. Send the `+` of an offset as `%2B`. A bare
`+` in a query string arrives as a space, and the instant is refused.

A row for an [async task]({{ '/docs/traces/' | relative_url }}#async-rows) answers no request,
so `route`, `path` and `statusCode` never list it. Its `outcome` and `durationMs` are the task's
own, and those are what `outcome` and `minDurationMs` judge.

A trace still in flight can change between the filter and the response. A row can list under
`outcome=OK` and read `ERROR`, or under `outcome=IN_PROGRESS` and read complete. A failure never
clears, so `outcome=ERROR` never lists a row that reads `OK`.

```bash
curl -G 'http://localhost:8080/peekaboot/api/traces' \
  --data-urlencode 'route=/persons/{id}' \
  --data-urlencode 'outcome=error' \
  --data-urlencode 'since=2026-11-01T10:00:00+01:00'
```

`-G` with `--data-urlencode` encodes the braces and the `+`. In the URL itself, curl would read
`{id}` as one of its own patterns.

With tracing off, the response has no traces and zero counts.

### Root action types {#root-action-types}

The API values and what each means are under [Traces, trace
types]({{ '/docs/traces/' | relative_url }}#root-action-type).

### Response {#trace-list-response}

```
{traces: [{summary, data}], bucketCounts: {all, errors, slow},
 filteredBucketCounts: {all, errors, slow}, next}
```

Each row is a [trace resource](#trace-fields). With `view=summary`, the default, every row's
`data` is `null`. Ask for `view=full` to get each row's spans, logs and queries.

`bucketCounts` counts what the store holds. `filteredBucketCounts` counts the traces that
match every filter. It is `null` when nothing filters, that is `rootActionType=*` with no other
filter, and while tracing is off.

A trace with [background work]({{ '/docs/traces/' | relative_url }}#background-work) appears once
for itself and once more for each async task it started. Those extra rows count towards
`limit`. The bucket counts count each trace once.

The list leaves out a trace's own row while some of its spans have arrived and its root has not.
Before any of its spans arrive, the trace lists with `summary.complete` set to `false`. Fetch the
[single trace](#single-trace) to follow a trace still in flight.

### Paging {#trace-list-paging}

The list is newest first. `next` is the `cursor` for the page after this one, and `null` on the
last page. Send it back as it is, with the same filters, to read on.

A cursor names the position of the page's last row. The next page lists what sorts below it as
the store stands then, so no older row is listed twice or skipped. A trace that leaves the store
shifts no other row. A cursor carries no filters. Sent with others, it pages through what those
match below the same position.

A trace that enters a bucket after the cursor was handed out lists above it, and so does an
async task that ends. A trace that enters a bucket again, All after Errors or Slow kept it,
moves to the top. A trace's own row keeps the position it took when it entered the bucket. In
All, that is when the store first received anything for it.

So a request still running while you page can show up below the cursor once it finishes, or
above the cursor, among rows you have already read. Read the first page again to catch it. A cursor means
something only to the running application that handed it out. A restart starts its count over.

### The trace resource {#trace-fields}

List rows and the [single trace](#single-trace) share one shape, `{summary, data}`:

```
{summary: {traceId, startTime, durationMs, complete, rootActionType, rootOperation, request,
           outcome, buckets, reasons, cause, issues, hotspots, counts, subtree},
 data: {rootSpan, orphans, logs, queries, httpExchange}}
```

`summary` says how the trace went. `data` holds the spans, logs and queries behind it.

#### Summary fields {#summary-fields}

| Field | Meaning |
|---|---|
| `startTime` | When the trace started. `null` while no span with a start time has arrived. |
| `durationMs` | How long the trace took, [background work]({{ '/docs/traces/' | relative_url }}#background-work) excluded. |
| `complete` | `true` once the trace's root span has arrived. See [Single trace](#single-trace). A row for an async task is always `true`. |
| `rootActionType` | What started the trace, see [Traces, trace types]({{ '/docs/traces/' | relative_url }}#root-action-type). `UNKNOWN` while the root is missing. |
| `rootOperation` | The name of the row's root span. `null` while the root is missing. |
| `request` | The root span's HTTP request, `{method, route, path, statusCode}`. `route` is the route tag as recorded, such as `/persons/{id}`, and `null` when the request recorded none, or only a placeholder such as `NOT_FOUND`. Under Spring Boot's default static-resource mapping, a request no controller matched carries `/**`. `request` is `null` when the root is missing or is no HTTP request. |
| `outcome` | `IN_PROGRESS` while `complete` is `false`. Else `ERROR` when a span failed, a server span answered with a 5xx or a line was logged at `ERROR`. Else `OK`. A 4xx is no failure. |
| `buckets` | The buckets that hold the trace now: `ERRORS`, `SLOW`, both in that order, or none. `ALL` is never named. |
| `reasons` | Why the trace failed or ran slow, `[{kind, spanId, detail}]`. See [reasons](#reasons). |
| `cause` | Where to start reading a failed trace, `{type, message, applicationFrame, spanId}`. See [cause](#cause). |
| `issues` | Every span's [issues](#issue-fields), in the order the Spans tab draws the tree. |
| `hotspots` | The spans with the most self time, at most three, largest first: `[{spanId, name, selfMs}]`. A span with no self time is left out. |
| `counts` | `{spans, queries: {count, totalDurationMs}, logs: {count, errorCount, warnCount}, droppedSpans, droppedLogs}`. See [counts](#counts). |
| `subtree` | `null` for a whole trace. On a row for an async task: `{rootSpanId, enclosedByStoredTrace}`. `enclosedByStoredTrace` is `false` when the task's parent span is no longer in the store. |

A failure stays on a whole trace. When the caps evict the span or the log line that failed
it, `outcome` still reads `ERROR`, though no reason or cause names it.

Some 4xx answers read `ERROR` too, see [Traces, outcome and
issues]({{ '/docs/traces/' | relative_url }}#exception-views).

A row for an async task reports the task's own work. Its `startTime`, `durationMs`, `outcome`,
`reasons`, `cause`, `issues`, `hotspots`, logs and queries cover the task alone. So do
`counts.spans`, `counts.queries` and `counts.logs`. `buckets`, `counts.droppedSpans` and
`counts.droppedLogs` are its trace's. Its `request` is `null`.

#### Reasons {#reasons}

`reasons` lists the failing spans as `EXCEPTION`, then the server spans that answered with a
5xx as `SERVER_ERROR`, each in tree order. The `ERROR` log lines follow as `ERROR_LOG`, in the
order they were logged. Last comes `SLOW` when `durationMs` reached
[`slow-trace-threshold-ms`]({{ '/docs/configuration/' | relative_url }}#peekaboottracing).
On a row for an async task that is the task's own duration, so the row can carry `SLOW` while
its trace is not in Slow.

`spanId` is the span a reason is about. On `SLOW` it is the root span, `null` while the root is
missing. On `EXCEPTION`, `detail` names the span's exception by its type and message. On
`ERROR_LOG` it is the line's masked message, and otherwise one plain sentence. The dashboard
shows the SLOW badge on a trace with a `SLOW` reason.

#### Cause {#cause}

`cause` is the first of these the trace holds:

1. A failing span with a stack trace.
2. An `ERROR` log line with a stack trace. `type` and `message` come from the stack trace's
   first line.
3. A failing span that names its exception's type or message. It is reached only when no
   failing span has a stack trace, so `applicationFrame` is `null`.
4. The first `ERROR` log line without a stack trace. Its message is `message`, and `type` and
   `applicationFrame` are `null`.
5. The first server span that answered with a 5xx. `message` names the status, and `type` and
   `applicationFrame` are `null`.

Within steps 1 and 3 the deepest failing span wins. Of two at one depth, the one the tree lists
first wins. Steps 2 and 4 take the first line logged.

`applicationFrame` is the first stack frame `applicationFrames` marks, without its `at`, such as
`com.acme.OrderService.place(OrderService.java:42)`. `null` when the stack trace has no frame of
your application. `spanId` is the failing span, the span the line was logged on, or the server
span that answered with the 5xx.

`cause` is `null` when nothing failed, when the caps evicted what failed the trace, or when its
only failure is a span that names no exception type or message.

#### Counts {#counts}

`spans` counts the stored spans and `queries` the database queries among them. `logs` counts the
stored log lines by level. `droppedSpans` counts the spans
[`max-spans-per-trace`]({{ '/docs/configuration/' | relative_url }}#peekaboottracing) evicted,
which no other count includes. `droppedLogs` counts the lines `max-logs-per-trace` dropped. The
dashboard shows a `TRUNCATED` badge when `droppedSpans` is above zero.

#### Data fields {#data-fields}

| Field | Meaning |
|---|---|
| `rootSpan` | The span tree, see [span fields](#span-fields). `null` while `summary.complete` is `false`, and on a complete trace whose root [`max-spans-per-trace`]({{ '/docs/configuration/' | relative_url }}#peekaboottracing) dropped. |
| `orphans` | While `rootSpan` is `null`, every stored span as subtrees, earliest start first. `[]` when there is a `rootSpan`. |
| `logs` | The trace's [log lines](#log-fields). |
| `queries` | The trace's [queries](#query-fields). |
| `httpExchange` | Request and response details. `null` on a row for an async task, and when none was captured. |

### Span fields {#span-fields}

Each span is `{spanId, name, kind, startTime, durationMs, selfMs, status, children, tags, events,
issues, exception, statement, rowCount, asyncEntry}`.

| Field | Meaning |
|---|---|
| `selfMs` | The part of `durationMs` no child span covered, each child cut to the span's own window. |
| `status` | `OK` or `ERROR`. |
| `issues` | The span's [issues](#issue-fields). |
| `exception` | Why the span failed, `{type, message, stackTrace, hiddenFrames, applicationFrames}`. `null` on spans that did not fail, also when they recorded an exception they handled. |
| `statement` | The [statement](#statement-fields) of a database query span. `null` on other spans and when no statement was recorded. |
| `rowCount` | Rows returned by a query, where the JDBC instrumentation reported it. |
| `asyncEntry` | `true` on the span that starts an async task. |

In `exception`, `type` is the canonical class name of the last exception recorded on the span,
such as `com.acme.Outer.Inner`. It is `null` when the span failed without recording an
exception, and for an anonymous or local class, which has no canonical name. `message` is the
exception's message, else the span's error description, masked by value shape. It is `null`
when neither is set.

`stackTrace` is `null` when no exception was recorded, and is cut at 1,000 lines.
`hiddenFrames` and `applicationFrames` index into it as they do on a [log entry](#log-fields).

### Issue fields {#issue-fields}

Each issue is `{type, severity, spanId, value, threshold, unit, message}`. What raises each type
is under [Traces, issues]({{ '/docs/traces/' | relative_url }}#issues).

| Field | Meaning |
|---|---|
| `type` | `SLOW`, `VERY_SLOW`, `SLOW_QUERY`, `REPEATED_QUERY` or `CLIENT_ERROR`. |
| `severity` | `error` for `VERY_SLOW`, `warning` for the others. |
| `spanId` | The span the issue is on. |
| `value` | What the span measured, in `unit`. |
| `threshold` | The limit `value` reached. |
| `unit` | `ms`, `queries` or `status`. |
| `message` | One plain sentence that names the value. |

`SLOW` and `VERY_SLOW` measure the span's `selfMs`, and `SLOW_QUERY` the query's `durationMs`,
all in `ms`. `CLIENT_ERROR` carries the response status against a `threshold` of `400`, in
`status`. `REPEATED_QUERY` counts in `queries`, one issue per statement that reached the
threshold. Its `spanId` is the span the queries ran under, and it adds four fields:

| Field | Meaning |
|---|---|
| `statement` | The statement with its literals replaced by `?` and its whitespace collapsed, masked. |
| `count` | How many times it ran, the same number as `value`. |
| `totalMs` | The queries' durations added up. |
| `spanIds` | The query spans, earliest start first. |

### Query fields {#query-fields}

Each entry in the trace's `queries` is `{spanId, dbSystem, dataSourceName, durationMs, rowCount,
statement}`. A query whose span recorded no statement is listed all the same.

| Field | Meaning |
|---|---|
| `spanId` | The query's span. |
| `dbSystem` | The database the span names, such as `postgresql`. `null` when nothing named one. |
| `dataSourceName` | The HikariCP pool name, else the DataSource name. A generated pool name such as `HikariPool-1` is skipped. `null` when neither is known. |
| `durationMs` | How long the query span took. |
| `rowCount` | Rows returned, where the JDBC instrumentation reported it. |
| `statement` | The query's [statement](#statement-fields), the same one its span carries. `null` when the span recorded none. |

### Statement fields {#statement-fields}

A span's `statement` is `{text, formatted, parameters, omittedParameterSets}`. Every part is masked
by value shape.

| Field | Meaning |
|---|---|
| `text` | The SQL as captured. A batch is its statements joined by `;` and a newline. |
| `formatted` | The same SQL laid out by Hibernate's formatter. `null` without Hibernate on the classpath, or when the formatter could not lay it out. |
| `parameters` | The bind parameters as SQL literals, one list per parameter set. A batch has several sets, a statement without parameters none. A value over 1,000 characters is cut. A batch records at most 100 sets. |
| `omittedParameterSets` | How many parameter sets a batch past 100 left out of `parameters`. `0` for every other statement. |

### Log fields {#log-fields}

Each entry in the trace's `logs` is `{traceId, spanId, timestamp, level, logger, thread, message,
stackTrace, hiddenFrames, applicationFrames}`.

`logger` is the name of the logger the line was written to and `thread` the name of the thread
that wrote it. Neither is masked. `message` is empty when Logback hands over a line without one.
The [log search](#log-search) serves the same shape.

`stackTrace` is `null` when the log event carried no exception. `hiddenFrames` and
`applicationFrames` are lists of `{start, endExclusive}` line ranges into `stackTrace`. They
mark the framework frames the dashboard folds and your application's own frames.
`hiddenFrames` is empty when [`peekaboot.stack-trace.fold`]({{ '/docs/configuration/' | relative_url }}#peekabootstacktrace)
is off.

## Single trace {#single-trace}

`GET /peekaboot/api/traces/{traceId}` returns one whole trace with its summary and its data,
as a [trace resource](#trace-fields).

- `404` with a [problem body](#errors) means the store does not hold the trace. The id is
  unknown or evicted, tracing is off, or it was a request to Peekaboot itself.
- `200` with `summary.complete` set to `false` means spans are still arriving.
  `data.rootSpan` is `null` and the spans that have arrived are under `data.orphans`. Poll
  until `summary.complete` is `true`. How long that
  takes is the span export delay, see [Spring Boot defaults Peekaboot
  changes]({{ '/docs/configuration/' | relative_url }}#what-peekaboot-sets-in-your-application).

A trace is complete once a span without a parent arrives. A request that continues a caller's
trace through a `traceparent` header has its parent elsewhere, so its trace is complete once
its own server span arrives.

An application that calls itself over HTTP reads complete for a moment, rooted at the inner
request's server span, until the outgoing call's client span arrives. It reads in progress
again until the real root arrives.

## Log search {#log-search}

`GET /peekaboot/api/logs` searches every log line the store holds, inside traces and outside
them, newest first in the order they were captured.

| Parameter | Values | Default | Invalid value |
|---|---|---|---|
| `level` | `TRACE`, `DEBUG`, `INFO`, `WARN` or `ERROR`, any case. Lists that level and every one above. | every level | `400` |
| `q` | Text the line's message or stack trace contains, in any case | none | none |
| `logger` | The start of the logger's name, as written | none | none |
| `traceId` | One trace's id | every trace and the lines outside traces | none |
| `since`, `until` | ISO-8601 instants bounding the line's `timestamp`, `since` in and `until` out | none | `400` |
| `limit` | 1 to 10000 | `100` | `400` |
| `cursor` | The `next` of an earlier response | none, the first page | `400` |

The response is `{logs, next}`, each entry a [log line](#log-fields). With tracing off, `logs`
is empty and `next` is `null`.

A line written outside any trace has `traceId` and `spanId` `null`. Such a line was written
during startup, on a thread without the trace context, or by Tomcat after the request's trace
ended. Capture starts once Peekaboot attaches its appender while the application context starts,
so Spring Boot's first startup lines are never captured.
Peekaboot keeps the newest
[`peekaboot.tracing.max-untraced-logs`]({{ '/docs/configuration/' | relative_url }}#peekaboottracing)
of them (1000). A trace's lines go with the trace, up to `max-logs-per-trace`.

`q` matches the text the response shows, after [masking]({{ '/docs/security/' | relative_url }}#masking).
A secret the masking rules replace cannot be found, and `q=******` finds the lines that held
one. `q` is plain text, so `(` and `*` match themselves. `logger=com.acme.orders` also lists
`com.acme.ordersarchive`.

`next` works as on the [trace list](#trace-list-paging). A line captured between two pages lists
above the cursor. Several threads store lines at once, so a line stored while a search runs can
still show up on a later page, below the cursor. It can also miss that page and every later one,
and then shows up when a search starts again without a `cursor`.

```bash
curl -G 'http://localhost:8080/peekaboot/api/logs' --data-urlencode 'level=warn' --data-urlencode 'q=timeout'
```

## Routes {#routes}

`GET /peekaboot/api/routes` sums up the HTTP requests the All bucket holds now, one row per
method and route pattern, busiest first:

```
{window: {from, to, traceCount},
 routes: [{method, route, count, errorCount, p50Ms, p95Ms, maxMs,
           latestErrorTraceId, latestSlowTraceId, issueCounts}]}
```

| Field | Meaning |
|---|---|
| `window` | The requests counted. `from` and `to` are the earliest and latest of their start times, `null` when there are none. `traceCount` is how many there are. |
| `method`, `route` | The request method and its route as `summary.request.route` shows it, such as `/persons/{id}`. |
| `count` | The route's requests. |
| `errorCount` | Those whose [outcome](#summary-fields) is `ERROR`. A 4xx alone is none. |
| `p50Ms`, `p95Ms`, `maxMs` | The median, the 95th percentile and the longest of their `durationMs`. The percentiles are nearest rank over every request. |
| `latestErrorTraceId` | The newest request whose outcome is `ERROR`, `null` when none failed. |
| `latestSlowTraceId` | The newest request that took at least `slow-trace-threshold-ms`, the one a `SLOW` reason names. `null` when none did. |
| `issueCounts` | For each [issue type](#issue-fields), how many requests carry at least one issue of that type. Every type is named, `0` where no request has one. |

Under Spring Boot's default static-resource mapping, a GET or a POST that no controller matched
carries the route `/**` and is answered `404`. Those requests share a `/**` row per method. The
`route: null` row holds the requests recorded without a route tag, or with only a placeholder
such as `NOT_FOUND`.

Only complete traces whose root is an HTTP request count. A request's async tasks count with
it, and their failures fail it. The numbers cover what All holds at the moment of the call, at
most `max-traces` traces, and nothing is kept between calls. With tracing off, `routes` is
empty and `traceCount` is `0`. Fetch a `latestErrorTraceId` as a [single trace](#single-trace)
to read the failure.

## Metric charts {#the-insights-endpoints}

The `/peekaboot/api/insights/**` endpoints back the [Insights]({{ '/docs/insights/' | relative_url }})
tab. They return `404` when `peekaboot.insights.enabled=false` or there is no `MeterRegistry`.

`GET /peekaboot/api/insights/config` returns:

- `levels`: `[{index, intervalMs, size}]`.
- `panels` in display order: `[{id, title, chart, unit, level, series: [{id, label, unit}]}]`.
  `level` is `null` unless the panel sets one.
- `tiles`: `[{id, label, format, live, value}]`.

Series ids have the form `<panelId>.<seriesId>`. `/data` and the stream use the same ids.

`GET /peekaboot/api/insights/data?level=n` returns one level's history:
`{level, intervalMs, endEpochMs, count, series: {id: {values, stats}}}`.

- Level 0 fills `values`, one number per tick. `stats` is `null`.
- Higher levels fill `stats` with the arrays `min`, `max`, `avg`, `median`, `p90`, `p95` and
  `p99`. `values` is `null`.
- Arrays hold no timestamps. Derive each position's time from `endEpochMs` and
  `intervalMs`. A missing sample is `null`.
- A missing `level`, or one outside the configured levels, answers `400` with a
  [problem body](#errors) that names `level` and the accepted range. A non-numeric `level` is a
  `400` problem too.

`GET /peekaboot/api/insights/stream` is a Server-Sent Events stream with two events:

| Event | Sent | Data |
|---|---|---|
| `tick` | Every level-0 interval | `{epochMs, values: {seriesId: v}}` |
| `rollup` | When a higher level's interval closes | `{level, epochMs, entries: {seriesId: {min, max, avg, median, p90, p95, p99}}}` |

- A comment heartbeat goes out once 15 seconds pass without an event. At the default
  10-second tick none is sent.
- At most 32 streams can be open. Further requests get `503`; retry later.
- The server closes each stream after 30 minutes. `EventSource` reconnects on its own.
- Events are not replayed. After a reconnect, fetch `/data` again for the levels you show.

## Restart history {#restart-history}

The `/peekaboot/api/lifecycle/**` endpoints back the Lifecycle tab and the restart markers on
the Insights charts. They return `404` when `peekaboot.lifecycle.enabled=false`. With
[`peekaboot.storage.enabled`]({{ '/docs/configuration/' | relative_url }}#peekabootstorage)
off they cover only the current run.

`GET /peekaboot/api/lifecycle/events` returns every start and stop, oldest first:

```
{events: [{type, timestamp, version, branch, shortCommitId, buildTime, uncleanPrevious}]}
```

- `type` is `start` or `stop`. A stop carries only `type` and `timestamp`.
- A start carries the build fields that changed since the previous start. The first start
  carries all of them.
- `uncleanPrevious` is `true` when the previous run recorded no stop.

`GET /peekaboot/api/lifecycle/runs` returns one entry per run, newest first:

```
{runs: [{startedAt, stoppedAt, ranForMs, downForMs, version, branch,
         shortCommitId, buildTime, changed, running, uncleanExit}]}
```

- Each row carries its full build info.
- `changed` lists which of `version`, `branch` and `commit` differ from the run before. It is
  `[]` for the oldest run.
- `uncleanExit: true` means the run recorded no stop. `stoppedAt` and `ranForMs` are
  then `null`.
- On the `running` row, `stoppedAt` is `null` and `ranForMs` is the time so far.
- `downForMs` is `null` when the gap to the previous run is unknown.

See [The dashboard, Lifecycle]({{ '/docs/dashboard/' | relative_url }}#lifecycle).
