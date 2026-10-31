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
| [`/peekaboot/api/traces/insights`](#trace-list) | `limit`, `bucket`, `rootActionType`, `rootOperation` | `200`, `400` |
| [`/peekaboot/api/traces/{traceId}/insights`](#single-trace) | none | `200`, `404` |
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
| `400` | An unknown `bucket` or `rootActionType` value. `detail` lists the accepted values. | The parameter |
| `400` | A value that is not a number or boolean where one is expected, such as `limit=abc` or `unmask=maybe`. | The parameter |
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

`GET /peekaboot/api/traces/insights` returns the newest traces first.

| Parameter | Values | Default | Invalid value |
|---|---|---|---|
| `limit` | 0 to 10000 | `100` | Out of range is clamped. Not a number: `400`. |
| `bucket` | `all`, `errors`, `slow`, any case | `all` | `400`, see [Errors](#errors). |
| `rootActionType` | Comma-separated [root action types]({{ '/docs/traces/' | relative_url }}#root-action-type), any case, or `*` alone | Every type except `MAINTENANCE` | An unknown name, an empty entry or `*` among names: `400`. |
| `rootOperation` | Part of the name of the row's root span, any case | none | none |

`rootActionType=*` includes `MAINTENANCE`.

A `rootOperation` with more than two dot-separated segments also matches on its last two. So
`com.acme.ReportJob.run` finds a scheduled task span named `reportJob.run`.

With tracing off, the response has no traces and zero counts.

### Root action types {#root-action-types}

The API values and what each means are under [Traces, trace
types]({{ '/docs/traces/' | relative_url }}#root-action-type).

### Response {#trace-list-response}

```
{traces: [...], bucketCounts: {all, errors, slow}, filteredBucketCounts: {all, errors, slow}}
```

`bucketCounts` counts what the store holds. `filteredBucketCounts` counts the traces that
match `rootActionType` and `rootOperation`. It is `null` for `rootActionType=*` without a
`rootOperation`, and while tracing is off.

A trace with [background work]({{ '/docs/traces/' | relative_url }}#background-work) appears once
for itself and once more for each async task it started. Those extra rows count towards
`limit`. The bucket counts count each trace once.

The list leaves out a trace's own row while some of its spans have arrived and its root has not.
Before any of its spans arrive, the trace lists with `complete: false`. Fetch the
[single trace](#single-trace) to follow a trace still in flight.

### Trace fields {#trace-fields}

List rows and the [single trace](#single-trace) share one shape:

```
{traceId, startTime, durationMs, status, complete, outcome, slow, rootActionType, rootOperation,
 rootSpan, orphans, summary, httpExchange, logs, queries, subtree, truncated}
```

| Field | Meaning |
|---|---|
| `status` | `HAS_ERRORS` when any span failed, else `OK`. |
| `complete` | `true` once the trace's root span has arrived. See [Single trace](#single-trace). A row for an async task is always `true`. |
| `outcome` | `IN_PROGRESS` while `complete` is `false`, else `ERROR` when `status` is `HAS_ERRORS`, else `OK`. |
| `slow` | `true` when any span has a `SLOW` or `VERY_SLOW` issue. This is the SLOW badge, which is independent of the Slow bucket. See [Traces]({{ '/docs/traces/' | relative_url }}#slow-badge-vs-slow-bucket). |
| `rootOperation` | The name of the row's root span. |
| `rootSpan` | The span tree. `null` while `complete` is `false`, and on a complete trace whose root [`max-spans-per-trace`]({{ '/docs/configuration/' | relative_url }}#peekaboottracing) dropped. |
| `orphans` | While `rootSpan` is `null`, every stored span as subtrees, earliest start first. `[]` when there is a `rootSpan`. |
| `summary` | Counts and durations of the request, spans, queries and logs. |
| `httpExchange` | Request and response details. Always `null` on list rows. |
| `logs`, `queries` | Always arrays. Empty on list rows, filled on the single trace. |
| `subtree` | `null` for a whole trace. On a row for an async task: `{rootSpanId, enclosedByStoredTrace}`. `enclosedByStoredTrace` is `false` when the task's parent span is no longer in the store. |
| `truncated` | `true` when [`max-spans-per-trace`]({{ '/docs/configuration/' | relative_url }}#peekaboottracing) dropped spans. Once set, it stays set. The dashboard shows a `TRUNCATED` badge. |

A row for an async task carries that task's own start time, duration, status and summary.

### Span fields {#span-fields}

Each span is `{spanId, name, kind, startTime, durationMs, status, children, tags, events,
issues, exception, statement, rowCount, asyncEntry}`.

| Field | Meaning |
|---|---|
| `status` | `OK` or `ERROR`. |
| `issues` | `[{type, severity}]`. `type` is `SLOW`, `VERY_SLOW` or `SLOW_QUERY`; `severity` is `warning` or `error`. See [Traces, issues]({{ '/docs/traces/' | relative_url }}#issues). |
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

### Query fields {#query-fields}

Each entry in the trace's `queries` is `{spanId, dbSystem, dataSourceName, durationMs, rowCount}`.
Its statement is the [`statement`](#statement-fields) of the span that `spanId` names. A query whose
span recorded no statement is listed all the same.

| Field | Meaning |
|---|---|
| `spanId` | The query's span. |
| `dbSystem` | The database the span names, such as `postgresql`. `null` when nothing named one. |
| `dataSourceName` | The HikariCP pool name, else the DataSource name. A generated pool name such as `HikariPool-1` is skipped. `null` when neither is known. |
| `durationMs` | How long the query span took. |
| `rowCount` | Rows returned, where the JDBC instrumentation reported it. |

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

Each entry in the trace's `logs` is `{spanId, timestamp, level, message, stackTrace, hiddenFrames,
applicationFrames}`.

`stackTrace` is `null` when the log event carried no exception. `hiddenFrames` and
`applicationFrames` are lists of `{start, endExclusive}` line ranges into `stackTrace`. They
mark the framework frames the dashboard folds and your application's own frames.
`hiddenFrames` is empty when [`peekaboot.stack-trace.fold`]({{ '/docs/configuration/' | relative_url }}#peekabootstacktrace)
is off.

## Single trace {#single-trace}

`GET /peekaboot/api/traces/{traceId}/insights` returns one whole trace with its request
details, logs and queries.

- `404` with a [problem body](#errors) means the store does not hold the trace. The id is
  unknown or evicted, tracing is off, or it was a request to Peekaboot itself.
- `200` with `complete: false` means spans are still arriving. `rootSpan` is `null` and the
  spans that have arrived are under `orphans`. Poll until `complete` is `true`. How long that
  takes is the span export delay, see [Spring Boot defaults Peekaboot
  changes]({{ '/docs/configuration/' | relative_url }}#what-peekaboot-sets-in-your-application).

A trace is complete once a span without a parent arrives. A request that continues a caller's
trace through a `traceparent` header has its parent elsewhere, so its trace is complete once
its own server span arrives.

An application that calls itself over HTTP reads complete for a moment, rooted at the inner
request's server span, until the outgoing call's client span arrives. It reads in progress
again until the real root arrives.

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
