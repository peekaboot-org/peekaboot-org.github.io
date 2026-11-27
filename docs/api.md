---
title: HTTP API
lead: The JSON endpoints under /peekaboot/api. The dashboard and the dev toolbar read some of them, the rest are for agents and scripts.
permalink: /docs/api/
---

<div class="pk-callout pk-callout--warning" markdown="1">
On a local run these endpoints need no authentication. Read [Security, securing the
dashboard]({{ '/docs/security/' | relative_url }}#securing-the-dashboard) before you expose
them anywhere else.
</div>

## Conventions {#conventions}

- Optional fields are always present. A missing value is `null`, never an absent key.
- Every response carries `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.
- `spring.jackson.*` does not affect these responses, and Peekaboot does not change your
  application's JSON.
- All endpoints are `GET`.
- An endpoint refuses a query parameter it does not take, and any parameter sent more than once,
  with a `400`. [Endpoints](#endpoints) lists what each one takes.
- A point in time Peekaboot records is an ISO-8601 string in UTC, such as
  `2026-10-23T10:15:30.123456Z`. Epoch milliseconds appear only in the insights endpoints: the
  fields named `epochMs` or `...EpochMs`, the `timestamps` array, and a `datetime` tile's value.
  Any other field ending in `Ms` is a duration.

## Endpoints {#endpoints}

| Endpoint | Parameters | Status codes |
|---|---|---|
| [`/peekaboot/api`](#openapi) | none | `200`, `400` |
| [`/peekaboot/api/openapi.json`](#openapi) | none | `200`, `400` |
| [`/peekaboot/api/features`](#features) | none | `200`, `400` |
| [`/peekaboot/api/actuator/all/insights`](#environment-and-configuration) | `locale`, `unmask` | `200`, `400` |
| [`/peekaboot/api/metrics`](#meters) | `name` | `200`, `400` |
| [`/peekaboot/api/traces`](#trace-list) | `limit`, `cursor`, `bucket`, `rootActionType`, `rootOperation`, `route`, `path`, `statusCode`, `outcome`, `minDurationMs`, `since`, `until`, `view` | `200`, `400` |
| [`/peekaboot/api/traces/{traceId}`](#single-trace) | none | `200`, `400`, `404` |
| [`/peekaboot/api/logs`](#log-search) | `level`, `q`, `logger`, `traceId`, `since`, `until`, `limit`, `cursor` | `200`, `400` |
| [`/peekaboot/api/routes`](#routes) | none | `200`, `400` |
| [`/peekaboot/api/errors`](#error-digest) | `since`, `route` | `200`, `400` |
| [`/peekaboot/api/health`](#health) | none | `200`, `400`, `503` |
| [`/peekaboot/api/insights/config`](#the-insights-endpoints) | none | `200`, `400`, `404` when Insights is off |
| [`/peekaboot/api/insights/data`](#the-insights-endpoints) | `level` (required), `view`, `series`, `since` | `200`, `400`, `404` when Insights is off |
| [`/peekaboot/api/insights/stream`](#the-insights-endpoints) | none | `200` (Server-Sent Events), `400`, `503`, `404` when Insights is off |
| [`/peekaboot/api/lifecycle/events`](#restart-history) | none | `200`, `400`, `404` when lifecycle is off |
| [`/peekaboot/api/lifecycle/runs`](#restart-history) | none | `200`, `400`, `404` when lifecycle is off |

The dashboard and the toolbar do not read the index, the OpenAPI document, the log search, the
routes, the error digest or the health report. Those six are for agents and scripts.

Where Peekaboot's guard is armed, every endpoint can also answer `401`. See
[Security, Peekaboot's guard]({{ '/docs/security/' | relative_url }}#peekaboots-guard).
On a local run every endpoint answers `403` to a request that does not come from the machine
the application runs on. See [Security, who can reach
Peekaboot]({{ '/docs/security/' | relative_url }}#who-can-reach-peekaboot).

`/peekaboot` and `/peekaboot/` redirect to the dashboard at
`/peekaboot/ui/dashboard/index.html`. See [The
dashboard]({{ '/docs/dashboard/' | relative_url }}).

## Index and OpenAPI document {#openapi}

`GET /peekaboot/api` lists every endpoint on this page with one line on what it is for, and
names where the OpenAPI document is:

```
{openapi, endpoints: [{path, purpose}]}
```

`GET /peekaboot/api/openapi.json` is an OpenAPI 3.1 document. It describes every endpoint,
parameter, response and problem body on this page, with each field's type and whether it can be
`null`.

Behind a `server.servlet.context-path` or a `spring.mvc.servlet.path`, the index's paths and the
document's `servers` entry carry that prefix.

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
| `400` | An unknown `bucket`, `rootActionType`, `view`, `outcome`, log search `level` or insights `series` id. `detail` lists the accepted values. | The parameter |
| `400` | A value that is no number, boolean, ISO-8601 instant or language tag, or is outside its range, such as `limit=0`, an `until` not later than `since`, a `route` that does not start with `/`, a missing or out-of-range insights `level`, or an empty id in `series`. `detail` gives the range. | The parameter |
| `400` | A `cursor` the endpoint did not hand out, or one handed out before the application restarted. | `cursor` |
| `400` | A parameter the endpoint does not take, or one sent more than once. `detail` lists the parameters it takes, or `none`. | The parameter |
| `404` | The store does not hold the [trace](#single-trace). | `null` |
| `401` | [Peekaboot's guard]({{ '/docs/security/' | relative_url }}#peekaboots-guard) refused the request. | `null` |
| `403` | A [local run]({{ '/docs/security/' | relative_url }}#who-can-reach-peekaboot) refused a request that does not come from its own machine. `detail` names `peekaboot.remote-access.enabled`. | `null` |
| `503` | The [insights stream](#the-insights-endpoints) is at its subscriber cap. | `null` |

{% include facts/guard-refusal.md %}

Any other error, such as the `404` while Insights or lifecycle is off, gets your application's
usual error response.

## Features {#features}

`GET /peekaboot/api/features` says which parts of Peekaboot are active and which thresholds
it uses. The dashboard shows or hides its tabs from it.

| Field | Meaning |
|---|---|
| `tracing` | The trace store exists (`peekaboot.tracing.enabled`). |
| `tracingSpansPossible` | An OpenTelemetry SDK is on the classpath to feed the store. `false` means no span can ever arrive. |
| `metrics` | A `MeterRegistry` bean exists. Drives the Meters tab. |
| `unmaskingEnabled` | `peekaboot.unmasking.enabled` is on. The "Show secrets" toggle depends on it. |
| `insights` | The Insights endpoints exist. |
| `lifecycle` | The `/peekaboot/api/lifecycle/**` endpoints exist (`peekaboot.lifecycle.enabled`). Drives the Lifecycle tab. |
| `slowSpanThresholdMs`, `verySlowSpanThresholdMs`, `slowQueryThresholdMs` | The effective thresholds from [`peekaboot.tracing`]({{ '/docs/configuration/' | relative_url }}#issue-thresholds). |
| `maskLiteral` | The string masked values are replaced with, `******`. |

## Environment and configuration {#environment-and-configuration}

<span id="what-insights-adds"></span>
`GET /peekaboot/api/actuator/all/insights` returns what the Overview, Environment, Config,
Loggers, Flyway, Liquibase and Scheduled Tasks tabs show:
`{application, runtime, dataSources, health, environment, loggers, flyway, liquibase, config,
scheduledTasks, server}`.

It works without any Actuator endpoint exposed. `management.endpoints.*` exposure settings
and the `show-values` and `show-details` settings have no effect on it.

### The `locale` parameter {#the-locale-parameter}

`locale` is a language tag such as `de-DE`. Omitted or blank means English. It changes only the
cron descriptions of scheduled tasks and the display name of the server's default locale.

### The `unmask` parameter {#the-unmask-parameter}

`unmask=true` asks for real values in place of masked ones. It works only with the server's
own opt-in. See [Security, two opt-ins before a real value is
shown]({{ '/docs/security/' | relative_url }}#masking-opt-ins).

### Scheduled tasks {#scheduled-tasks}

`scheduledTasks` is `{tasks, cronCount, fixedDelayCount, fixedRateCount, customCount}`, the tasks
and how many there are of each type.

Each task is `{target, type, schedule, scheduleDescription, intervalMs, lastExecution,
lastStatus, lastException, nextExecution}`. `type` is `CRON`, `FIXED_DELAY`, `FIXED_RATE` or
`CUSTOM`. `schedule` holds the cron expression, or a custom trigger's description of itself,
masked by value shape. It is `null` for fixed-rate and fixed-delay tasks, which carry
`intervalMs` instead.

## Meters {#meters}

`GET /peekaboot/api/metrics` returns every meter in the registry, grouped by name:

```
{metrics: [{name, description, baseUnit, type,
            measurements: [{tags, statistics: [{name, value}]}]}]}
```

`name` narrows the list to the meters whose name starts with it, such as `name=jvm.memory`.

Tag values that look like secrets are masked. A statistic whose `value` is NaN or infinite
reads `null`. Without a `MeterRegistry` the response is `{metrics: []}`.

## Trace list {#trace-list}

`GET /peekaboot/api/traces` returns the newest traces first.

| Parameter | Values | Default |
|---|---|---|
| `limit` | 1 to 10000, at most 100 with `view=full` | `100` |
| `cursor` | The `next` of an earlier response | none, the first page |
| `bucket` | `all`, `errors`, `slow`, any case | `all` |
| `rootActionType` | Comma-separated [root action types]({{ '/docs/traces/' | relative_url }}#root-action-type) with their API values, any case, or `*` alone, which includes `MAINTENANCE` | Every type except `MAINTENANCE` |
| `rootOperation` | Part of the name of the row's root span, any case | none |
| `route` | The request's route as `summary.request.route` shows it, such as `/persons/{id}`, exactly | none |
| `path` | The start of the request path as `summary.request.path` shows it, after masking | none |
| `statusCode` | `100` to `599`, exactly | none |
| `outcome` | `OK`, `ERROR`, `IN_PROGRESS` or `INTERRUPTED`, any case | none |
| `minDurationMs` | `0` or more. Lists rows whose `durationMs` is at least this. | none |
| `since`, `until` | ISO-8601 instants, such as `2026-11-01T10:15:30Z`, bounding the row's `summary.startTime`, `since` in and `until` out. Send the `+` of an offset as `%2B` | none |
| `view` | `summary` or `full`, any case | `summary` |

An invalid value answers `400`, see [Errors](#errors). Filters combine: a row lists when it
matches every one. A row for an [async task]({{ '/docs/traces/' | relative_url }}#async-rows)
answers no request, so `route`, `path` and `statusCode` never list it.

```bash
curl -G 'http://localhost:8080/peekaboot/api/traces' \
  --data-urlencode 'route=/persons/{id}' \
  --data-urlencode 'outcome=ERROR' \
  --data-urlencode 'since=2026-11-01T10:00:00+01:00'
```

`-G` with `--data-urlencode` encodes the braces and the `+`.

With tracing off, the response has no traces and zero counts.

### Response {#trace-list-response}

```
{traces: [{summary, data}], bucketCounts: {all, errors, slow},
 filteredBucketCounts: {all, errors, slow}, next}
```

Each row is a [trace resource](#trace-fields). With `view=summary`, the default, every row's
`data` is `null`. Ask for `view=full` to get each row's spans, logs and queries.

`bucketCounts` counts what the store holds. `filteredBucketCounts` counts the traces that
match every filter. It is `null` when nothing filters and while tracing is off.

A trace with [background work]({{ '/docs/traces/' | relative_url }}#background-work) appears once
for itself and once more for each async task it started. Those extra rows count towards
`limit`. The bucket counts count each trace once.

The list shows complete traces and traces still in flight. A trace whose spans have started to
arrive but whose root has not is not listed, so `outcome=INTERRUPTED` lists only interrupted
traces that hold no span. Fetch the [single trace](#single-trace) to follow the others.

### Paging {#trace-list-paging}

`next` is the `cursor` for the page after this one, and `null` on the last page. Send it back
unchanged, with the same filters. A list that changes while you page can repeat or skip rows, so
start again from the first page to be sure.

### The trace resource {#trace-fields}

List rows and the [single trace](#single-trace) share one shape, `{summary, data}`:

```
{summary: {traceId, startTime, durationMs, complete, run, rootActionType, rootOperation, request,
           outcome, buckets, reasons, cause, issues, hotspots, counts, subtree},
 data: {rootSpan, orphans, logs, queries, httpExchange}}
```

#### Summary fields {#summary-fields}

| Field | Meaning |
|---|---|
| `startTime` | When the trace started. `null` while no span with a start time has arrived. |
| `durationMs` | How long the trace took, [background work]({{ '/docs/traces/' | relative_url }}#background-work) excluded. |
| `complete` | `true` once the trace's root span has arrived. See [Single trace](#single-trace). A row for an async task is always `true`. |
| `run` | When the run of the application that produced the trace started, the `startedAt` of its row in [`/peekaboot/api/lifecycle/runs`](#restart-history). `null` until that run finished starting. |
| `rootActionType` | What started the trace, see [Traces, trace types]({{ '/docs/traces/' | relative_url }}#root-action-type). `UNKNOWN` while the root is missing. |
| `rootOperation` | The name of the row's root span. `null` while the root is missing. |
| `request` | The root span's HTTP request, `{method, route, path, statusCode}`. `path` is masked by value shape. `route` is the route tag as recorded, such as `/persons/{id}`, and `null` when the request recorded none, or only a placeholder such as `NOT_FOUND`. `request` is `null` when the root is missing or is no HTTP request. |
| `outcome` | `IN_PROGRESS` while `complete` is `false`, or `INTERRUPTED` for a trace [restored](#single-trace) from an earlier run that stopped before its root arrived. Else `ERROR` when a span failed, a server span answered with a 5xx or a line was logged at `ERROR`. Else `OK`. A 4xx is no failure. |
| `buckets` | The buckets that hold the trace now: `ERRORS`, `SLOW`, both in that order, or none. `ALL` is never named. |
| `reasons` | Why the trace failed or ran slow, `[{kind, spanId, detail}]`. See [reasons](#reasons). |
| `cause` | Where to start reading a failed trace, `{type, message, applicationFrame, spanId}`. See [cause](#cause). |
| `issues` | Every span's [issues](#issue-fields), in the order the Spans tab draws the tree. |
| `hotspots` | The spans with the most self time, at most three, largest first: `[{spanId, name, selfMs}]`. |
| `counts` | `{spans, queries: {count, totalDurationMs}, logs: {count, errorCount, warnCount}, droppedSpans, droppedLogs}`. See [counts](#counts). |
| `subtree` | `null` for a whole trace. On a row for an async task: `{rootSpanId, enclosedByStoredTrace}`. `enclosedByStoredTrace` is `false` when the task's parent span is no longer in the store. |

A row for an async task reports the task's own work. Its `buckets`, `counts.droppedSpans` and
`counts.droppedLogs` are its trace's, and its `request` is `null`.

#### Reasons {#reasons}

`reasons` lists the failing spans as `EXCEPTION`, then the server spans that answered with a
5xx as `SERVER_ERROR`, each in tree order. The `ERROR` log lines follow as `ERROR_LOG`, in the
order they were logged. Last comes `SLOW` when `durationMs` reached
[`slow-trace-threshold-ms`]({{ '/docs/configuration/' | relative_url }}#peekaboottracing).

`spanId` is the span a reason is about, the root span for `SLOW`. `detail` names the span's
exception by its type and message on `EXCEPTION`, is the line's masked message on `ERROR_LOG`,
and otherwise is one plain sentence.

#### Cause {#cause}

`cause` is the first of these the trace holds:

1. A failing span with a stack trace.
2. An `ERROR` log line with a stack trace. `type` and `message` come from the stack trace's
   first line.
3. A failing span that names its exception's type or message. `applicationFrame` is `null`.
4. The first `ERROR` log line without a stack trace. Its message is `message`, and `type` and
   `applicationFrame` are `null`.
5. The first server span that answered with a 5xx. `message` names the status, and `type` and
   `applicationFrame` are `null`.

`applicationFrame` is the first stack frame `applicationFrames` marks, without its `at`, such as
`com.acme.OrderService.place(OrderService.java:42)`. `null` when the stack trace has no frame of
your application. `spanId` is the failing span, the span the line was logged on, or the server
span that answered with the 5xx. `cause` is `null` when nothing failed.

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
| `httpExchange` | Request and response details. The request's `path` is masked by value shape. `null` on a row for an async task, and when none was captured. |

### Span fields {#span-fields}

Each span is `{spanId, name, kind, startTime, durationMs, selfMs, status, children, tags, events,
issues, exception, statement, rowCount, asyncEntry}`.

| Field | Meaning |
|---|---|
| `selfMs` | The part of `durationMs` no child span covered. |
| `status` | `OK` or `ERROR`. |
| `issues` | The span's [issues](#issue-fields). |
| `exception` | Why the span failed, `{type, message, stackTrace, hiddenFrames, applicationFrames}`. `null` on spans that did not fail. |
| `statement` | The [statement](#statement-fields) of a database query span. `null` on other spans and when no statement was recorded. |
| `rowCount` | Rows returned by a query, where the JDBC instrumentation reported it. |
| `asyncEntry` | `true` on the span that starts an async task. |

In `exception`, `type` is the canonical class name of the last exception recorded on the span,
`null` when none was recorded. `message` is the exception's message, else the span's error
description, masked by value shape. It is `null` when neither is set.

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
statement}`.

| Field | Meaning |
|---|---|
| `spanId` | The query's span. |
| `dbSystem` | The product the DataSource's JDBC URL names, such as `POSTGRESQL` or `H2`. Where the URL names none Peekaboot knows, the database or DataSource name the span carries. `null` when nothing named one. |
| `dataSourceName` | The HikariCP pool name, else the DataSource name. `null` when neither is known. |
| `durationMs` | How long the query span took. |
| `rowCount` | Rows returned, where the JDBC instrumentation reported it. |
| `statement` | The query's [statement](#statement-fields). `null` when the span recorded none. |

### Statement fields {#statement-fields}

A span's `statement` is `{text, formatted, parameters, omittedParameterSets}`. Every part is masked
by value shape.

| Field | Meaning |
|---|---|
| `text` | The SQL as captured. A batch is its statements joined by `;` and a newline. |
| `formatted` | The same SQL formatted for reading. `null` without Hibernate on the classpath, or when formatting failed. |
| `parameters` | The bind parameters as SQL literals, one list per parameter set. A batch has several sets, a statement without parameters none. |
| `omittedParameterSets` | How many parameter sets a batch left out of `parameters`. `0` for every other statement. |

`parameters` has these limits:

| Limit | Effect |
|---|---|
| A value over 1,000 characters | The value is cut. |
| More than 100 sets or 16,000 characters of values per statement | The rest is left out and counted in `omittedParameterSets`. |
| A single set cut short | It ends with a comment counting the parameters left out. |

### Log fields {#log-fields}

Each entry in the trace's `logs` is `{traceId, spanId, timestamp, level, logger, thread, message,
stackTrace, hiddenFrames, applicationFrames}`.

`logger` is the name of the logger the line was written to and `thread` the name of the thread
that wrote it. Neither is masked. The [log search](#log-search) serves the same shape.

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
- Right after a restart with [storage]({{ '/docs/configuration/' | relative_url }}#peekabootstorage)
  on, Peekaboot restores the stored traces in the background, so a just-restarted application may
  not list one yet.
- `200` with `summary.outcome` set to `IN_PROGRESS` means spans are still arriving.
  `data.rootSpan` is `null` and the spans that have arrived are under `data.orphans`. Poll
  until `summary.complete` is `true`.
- `200` with `summary.outcome` set to `INTERRUPTED` means the trace was restored from an
  earlier run of the application, which stopped before the root arrived. It never completes, so
  stop polling. See [persisted traces]({{ '/docs/traces/' | relative_url }}#persisted-traces).

A trace is complete once a span without a parent arrives. A request that continues a caller's
trace through a `traceparent` header is complete once its own server span arrives.

## Log search {#log-search}

`GET /peekaboot/api/logs` searches every log line the store holds, inside traces and outside
them, newest first in the order they were captured.

| Parameter | Values | Default |
|---|---|---|
| `level` | `TRACE`, `DEBUG`, `INFO`, `WARN` or `ERROR`, any case. Lists that level and every one above. | every level |
| `q` | Text the line's message or stack trace contains, in any case | none |
| `logger` | The start of the logger's name, as written | none |
| `traceId` | One trace's id | every trace and the lines outside traces |
| `since`, `until` | ISO-8601 instants bounding the line's `timestamp`, `since` in and `until` out | none |
| `limit` | 1 to 10000 | `100` |
| `cursor` | The `next` of an earlier response | none, the first page |

The response is `{logs, next}`, each entry a [log line](#log-fields). With tracing off, `logs`
is empty and `next` is `null`. `next` works as on the [trace list](#trace-list-paging).

Lines written outside a trace have `traceId: null`. Peekaboot keeps the newest
[`peekaboot.tracing.max-untraced-logs`]({{ '/docs/configuration/' | relative_url }}#peekaboottracing)
of them (1000). A trace's lines go with the trace, up to `max-logs-per-trace`. With
[storage]({{ '/docs/configuration/' | relative_url }}#peekabootstorage) on, they survive a
restart with the traces.

`q` matches the text the response shows, after [masking]({{ '/docs/security/' | relative_url }}#masking),
and is plain text, not a pattern.

One request reads at most 10000 lines. A page can then hold fewer lines than `limit`, or none,
and still carry a `next`. Follow `next` until it is `null`.

```bash
curl -G 'http://localhost:8080/peekaboot/api/logs' --data-urlencode 'level=WARN' --data-urlencode 'q=timeout'
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
| `p50Ms`, `p95Ms`, `maxMs` | The median, the 95th percentile and the longest of their `durationMs`. |
| `latestErrorTraceId` | The newest request whose outcome is `ERROR`, `null` when none failed. |
| `latestSlowTraceId` | The newest request that took at least `slow-trace-threshold-ms`, the one a `SLOW` reason names. `null` when none did. |
| `issueCounts` | For each [issue type](#issue-fields), how many requests carry at least one issue of that type. Every type is named, `0` where no request has one. |

Rows count the complete traces whose root is an HTTP request in the All bucket at the moment of
the call, with their async tasks. With tracing off, `routes` is empty and `traceCount` is `0`.

Requests no controller matched, under Spring Boot's default static-resource mapping, share one
`/**` row per method. The `route: null` row holds the requests recorded without a route.

Fetch a `latestErrorTraceId` as a [single trace](#single-trace) to read the failure.

## Error digest {#error-digest}

`GET /peekaboot/api/errors` lists every failure the application's traces showed, one entry per
exception class, route and application frame, the entry seen latest first:

```
{errors: [{type, route, applicationFrame, count, firstSeen, lastSeen,
           lastMessage, lastTraceId, traceAvailable, runs}]}
```

| Parameter | Values | Default |
|---|---|---|
| `since` | an ISO-8601 instant | none |
| `route` | a route pattern, matched exactly, such as `/orders/{id}` | none |

| Field | Meaning |
|---|---|
| `type`, `route`, `applicationFrame` | What makes two failed traces one entry: the [cause](#cause)'s class, the root request's route, and the cause's top frame in your application without its line number, such as `com.acme.OrderService.place(OrderService.java)`. `type` and `applicationFrame` are `null` where the cause names none, see [cause](#cause). `route` is `null` for a trace whose root is no HTTP request. |
| `count` | The failed traces. A trace counts once, the first time it is complete with `outcome: ERROR`. |
| `firstSeen`, `lastSeen` | When the earliest and the latest of them started. `since` keeps the entries whose `lastSeen` is at or after it. |
| `lastMessage`, `lastTraceId` | The latest trace's cause message, masked as on the trace, and its id. |
| `traceAvailable` | Whether the store still holds `lastTraceId`. Fetch it as a [single trace](#single-trace) while it is `true`. |
| `runs` | When each run the failure occurred in started, the last ten, oldest first. Each is the `startedAt` of a run in [`/peekaboot/api/lifecycle/runs`](#restart-history). |

The digest:

- Keeps 500 entries. Past that, the one seen least recently goes.
- Outlives the traces. One noisy failure can fill the Errors bucket, and the digest still lists
  every other failure.
- Survives a restart only with [storage]({{ '/docs/configuration/' | relative_url }}#peekabootstorage)
  and `peekaboot.storage.traces.enabled` on. Otherwise it lives in memory only.
- Is empty with tracing off.

## Health {#health}

`GET /peekaboot/api/health` answers whether the application is healthy, which targets it
connects to and what Peekaboot has seen go wrong lately:

```
{status, components: {<name>: {status, details, components, connection}}, problems, windowMs,
 traces: {errors, slow}, failures: [...]}
```

`status`, `components` and `details` are what `/actuator/health` reports, nested the same way.
`status` is the actuator's own string, so a status your application defines comes through
unchanged. It reads `UNKNOWN` where the health endpoint is off.

`connection` says what a component connects to. It comes from your configuration, so it is there
while the target is down. It is `null` for a component Peekaboot cannot describe.

| Component | `connection` |
|---|---|
| DataSource | `{dataSource, product, hosts: [{hostname, port}], database, instance}`. The bean's name, the product the JDBC URL names (`POSTGRESQL`), and the SQL Server instance where the URL has one. A `port` the URL leaves out is the driver's default, such as `5432` for PostgreSQL. Only Hikari pools are described. |
| Redis | `{hosts: [{hostname, port}], database}`. Lettuce and Jedis both work. `database` is `null` for a cluster. A Lettuce static master/replica setup shows `localhost:6379`. |
| Mail | `{host, port}` of each `JavaMailSenderImpl` bean behind the mail check, yours or Spring Boot's. `port` is `null` where none is set, and `connection` is `null` for a sender without a host. |

A user and password before the first host, as in `jdbc:mysql://user:pw@db/shop` or Oracle's
`user/password@db`, are left out. Where the driver refuses a user and password before the host, as
PostgreSQL's does, the URL gets no connection. A JDBC URL with a property whose name contains `user`, `uid`,
`pwd`, `pass`, `secret` or `token` (`?password=…`, `;userName=…`), or that Peekaboot masks as a
secret elsewhere (`apiKey`, `credentials`), gets no connection; put the credentials in `spring.datasource.username` and
`spring.datasource.password`. A DataSource has no `connection` either where its JDBC URL holds:

- a character outside ASCII anywhere;
- an `&` anywhere, for SQL Server;
- any other `@` after the `//`: a second one, or one in a query parameter or a later host;
- an `@` and a `\` together before the first `/`, `,`, `?`, `;`, `#` or `(` after the `//`, as in
  `jdbc:sqlserver://db\inst@x`;
- a user or password before the host with a `/`, `?`, `#`, `;`, `,`, `(` or `\` in it;
- a `{` or a `%` anywhere;
- a database or instance with a character other than a letter, digit, `.`, `_`, `$`, `~`, `-` or
  `/`, as an Oracle URL with parameters after the service name (`@//db:1521/svc?connect_timeout=5`)
  has;
- a database, instance or host name not written as such in the URL outside a user and password,
  such as an Oracle service name with a space in it.

A Redis connection factory you build yourself is described like one Spring Boot builds.
`connection` is `null` for a factory of another type and for a Lettuce unix-socket setup.

Where a component groups several beans, such as two DataSources, the group's own `connection` is
`null` and each child carries its own.

`problems`, `traces` and `failures` cover the last `windowMs` milliseconds, the span of the first
[Insights]({{ '/docs/insights/' | relative_url }}) level (15 minutes by default). They return to
empty after an incident. `problems` is empty while Insights is off. `traces` counts the Errors
and Slow traces that started in the window, and is `null` while tracing is off. `failures` holds
at most ten entries of the [error digest](#error-digest) last seen in the window, latest first,
with `type`, `route`, `applicationFrame`, `lastSeen`, `lastMessage` and `lastTraceId`.

The status code follows `status` the way `/actuator/health` maps it, including
`management.endpoint.health.status.http-mapping`: `503` for `DOWN` and `OUT_OF_SERVICE`, `200`
otherwise. The body is the same report either way.

With `peekaboot.health.fail-on-problems=true` a current problem of severity `error` also answers
`503`. `status` keeps the actuator's value, so read `problems` to see why. A non-`2xx` code your
mapping sets stays as it is.

The endpoint takes the guard's credentials, see [Security, Peekaboot's
guard]({{ '/docs/security/' | relative_url }}#peekaboots-guard), and the response is
`no-store`. It adds no timeout of its own: it answers as slowly as the slowest health check. A
Redis that does not answer can hold a call for its command timeout, about 60 seconds with
Lettuce's default. Set a monitor's timeout to match.

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

```
{level, intervalMs, endEpochMs, count, timestamps,
 series: {id: {summary: {min, avg, max, median, p95, latest, samples}, values, stats}},
 problems: [{rule, severity, series, value, threshold, unit, message}]}
```

| Parameter | Values | Default |
|---|---|---|
| `level` | a configured level, `0` to the last | none, required |
| `view` | `summary` or `full`, any case | `summary` |
| `series` | series ids separated by commas, such as `cpu.process,heap.used` | every series |
| `since` | an ISO-8601 instant | the whole ring |

- The window holds the `count` samples taken at or after `since`. The newest was taken at
  `endEpochMs`, the others one `intervalMs` apart before it.
- Every series carries a `summary` over the window. `samples` counts the level-0 samples behind
  it, and the statistics are `null` when it is `0`. Above level 0, `median` and `p95` are estimates:
  percentiles of the windows' own median and p95. `min`, `max` and `avg` are exact. `latest` is
  the newest sample, or the newest window's average above level 0.
- The `summary` view serves no samples: `values`, `stats` and `timestamps` are `null`. `full`
  adds them. Level 0 fills `values`, one number per tick, and higher levels fill `stats` with
  the arrays `min`, `max`, `avg`, `median`, `p90`, `p95` and `p99`. `timestamps` holds each
  position's time in epoch milliseconds, shared by every series. A missing sample is `null`.
- Each value is in its series' unit: a `percent` series from 0 to 100, `millis` in
  milliseconds.
- `series` narrows `series` only. `problems` always reads every series. Its rules are
  under [Problems](#problems).

`GET /peekaboot/api/insights/stream` is a Server-Sent Events stream with two events:

| Event | Sent | Data |
|---|---|---|
| `tick` | Every level-0 interval | `{epochMs, values: {seriesId: v}}` |
| `rollup` | When a higher level's interval closes | `{level, epochMs, entries: {seriesId: {min, max, avg, median, p90, p95, p99}}}` |

- {% include facts/insights-stream-cap.md -%}
- The server closes each stream after 30 minutes and drops slow clients. `EventSource`
  reconnects.
- Events are not replayed. After a reconnect, fetch `/data` again for the levels you show.

### Problems {#problems}

The `problems` of `/peekaboot/api/insights/data` list every rule the window reached. A problem
reads like a trace's [issue](#issue-fields), with `rule` and `series` in place of `type` and
`spanId`. `series` names the series the rule read. `value` is what the window measured and `threshold` the
limit it reached, both in `unit`. `severity` is `warning` or
`error`. `unit` is `percent`, `count` or `millis`, so a duration reads `millis` here where an
issue says `ms`.

| Rule | Severity | Measures | Reached at |
|---|---|---|---|
| `CPU_HIGH` | `warning` | The median of `cpu.process` | `cpu-high-percent` |
| `GC_OVERHEAD` | `warning` | The median of `cpu.gc-overhead` | `gc-overhead-percent` |
| `HEAP_NEAR_MAX` | `warning` | The median, per sample, of `heap.used` as a share of `heap.max` | `heap-near-max-percent` |
| `THREAD_GROWTH` | `warning` | How far the fewest `threads.live` of the window's last quarter rose above its first quarter's | `thread-growth` |
| `POOL_WAITING` | `error` | The most `db-pool.pending` | `pool-waiting` |
| `SERVER_ERRORS` | `error` | `http-throughput.server-errors` as a share of `http-throughput.requests`, summed over the window | `server-errors-percent` |
| `ERROR_LOGS` | `warning` | The lines logged at ERROR, from the `log-events.errors` rate | `error-logs` |
| `SLOW_HTTP` | `warning` | The p95 of `http-latency.avg` | `peekaboot.tracing.slow-trace-threshold-ms` |

The thresholds without a prefix are `peekaboot.insights.problems.*`, under [Insights
configuration]({{ '/docs/configuration/' | relative_url }}#peekabootinsights).

A rule is skipped when its series is switched off, has no meter in your application or holds too
few samples in the window, so a rule missing from the list may have been skipped. The dashboard
does not show `problems`.

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
- A start carries every build field it recorded.
- `uncleanPrevious` is `true` when the previous run recorded no stop.

`GET /peekaboot/api/lifecycle/runs` returns one entry per run, newest first:

```
{runs: [{startedAt, stoppedAt, ranForMs, downForMs, version, branch,
         shortCommitId, buildTime, changed, running, uncleanExit}]}
```

| Field | Meaning |
|---|---|
| `version`, `branch`, `shortCommitId`, `buildTime` | The run's full build info. |
| `changed` | Which of `version`, `branch` and `commit` differ from the run before. `[]` for the oldest run. |
| `uncleanExit` | `true` when the run recorded no stop. `stoppedAt` and `ranForMs` are then `null`. |
| `running` | `true` for the run the answering process recorded and has not stopped. `stoppedAt` is `null` and `ranForMs` is the time so far. |
| `downForMs` | `null` when the gap to the previous run is unknown. |

See [The dashboard, Lifecycle]({{ '/docs/dashboard/' | relative_url }}#lifecycle).
