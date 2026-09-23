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
  `X-Content-Type-Options: nosniff`. That includes its error responses and the event stream.
- Peekaboot serialises its responses with its own JSON converter. Your `spring.jackson.*`
  settings do not change them, and Peekaboot does not change your application's JSON.
- All endpoints are `GET`. A parameter that is not a number or boolean where one is expected
  gets Spring's `400`.

## Endpoints {#endpoints}

| Endpoint | Parameters | Status codes |
|---|---|---|
| [`/peekaboot/api/features`](#features) | none | `200` |
| [`/peekaboot/api/actuator/all/insights`](#what-insights-adds) | `locale`, `unmask` | `200` |
| [`/peekaboot/api/metrics`](#meters) | none | `200` |
| [`/peekaboot/api/traces/insights`](#trace-list) | `limit`, `bucket`, `rootActionType`, `rootOperation` | `200` |
| [`/peekaboot/api/traces/{traceId}/insights`](#single-trace) | none | `200`, `404` |
| [`/peekaboot/api/insights/config`](#the-insights-endpoints) | none | `200`, `404` when Insights is off |
| [`/peekaboot/api/insights/data`](#the-insights-endpoints) | `level` (required) | `200`, `400`, `404` when Insights is off |
| [`/peekaboot/api/insights/stream`](#the-insights-endpoints) | none | `200` (Server-Sent Events), `503`, `404` when Insights is off |
| [`/peekaboot/api/lifecycle/events`](#restart-history) | none | `200`, `404` when lifecycle is off |
| [`/peekaboot/api/lifecycle/runs`](#restart-history) | none | `200`, `404` when lifecycle is off |

Where Peekaboot's own HTTP Basic guard is armed, every endpoint can also answer `401`. See
[Security]({{ '/docs/security/' | relative_url }}#if-nothing-else-secures-it).

`/peekaboot` and `/peekaboot/` redirect to the dashboard at
`/peekaboot/ui/dashboard/index.html`. See [The
dashboard]({{ '/docs/dashboard/' | relative_url }}).

## Features {#features}

`GET /peekaboot/api/features` says which parts of Peekaboot are active and which thresholds
it uses. The dashboard shows or hides its tabs from it.

| Field | Meaning |
|---|---|
| `tracing` | The trace store exists (`peekaboot.tracing.enabled`). |
| `tracingSpansPossible` | An OpenTelemetry SDK is on the class path to feed the store. `false` means no span can ever arrive. `true` does not promise that one will, since your sampling settings still apply. Ignore it while `tracing` is `false`. |
| `metrics` | A `MeterRegistry` bean exists. Drives the Meters tab. |
| `devToolbar` | `peekaboot.dev-toolbar` is on. |
| `unmaskingEnabled` | `peekaboot.enable-unmasking` is on. The "Show secrets" toggle depends on it. |
| `insights` | The Insights endpoints exist. |
| `slowSpanThresholdMs`, `verySlowSpanThresholdMs`, `slowQueryThresholdMs` | The effective thresholds from [`peekaboot.ui.tracing`]({{ '/docs/configuration/' | relative_url }}#peekabootuitracing). |
| `slowTraceThresholdMs` | The Slow bucket's threshold. `null` while tracing is off. |
| `maskLiteral` | The string masked values are replaced with, `******`. |

## Environment and configuration {#what-insights-adds}

`GET /peekaboot/api/actuator/all/insights` returns what the Overview, Environment, Config,
Loggers, Flyway and Scheduled Tasks tabs show:
`{application, runtime, dataSources, health, environment, loggers, flyway, config,
scheduledTasks, server}`.

It works without any Actuator endpoint exposed. `management.endpoints.*` exposure settings
and the `show-values` and `show-details` settings have no effect on it. A source that is
missing (no Flyway, say) or fails leaves the rest of the response intact.

### The `locale` parameter {#the-locale-parameter}

`locale` is a language tag such as `de-DE`. `de_DE` works too. Omitted or blank means English.

It changes only the cron descriptions of scheduled tasks and the display names of the server's
time zone and default locale. The dashboard sends `en-US`, `de-DE`, `fr-FR` or `es-ES`; see
[The dashboard, the header]({{ '/docs/dashboard/' | relative_url }}#the-header).

### The `unmask` parameter {#the-unmask-parameter}

`unmask=true` returns secrets in clear text only while `peekaboot.enable-unmasking=true` is
set on the server. Without that property the parameter is ignored. See [Security,
masking]({{ '/docs/security/' | relative_url }}#masking-opt-ins).

### Scheduled tasks {#scheduled-tasks}

Each task is `{target, type, schedule, scheduleDescription, intervalMs, lastExecution,
lastStatus, lastException, nextExecution}`. `type` is `CRON`, `FIXED_DELAY` or `FIXED_RATE`.
`schedule` holds the cron expression and is `null` for fixed-rate and fixed-delay tasks, which
carry `intervalMs` instead.

## Meters {#meters}

`GET /peekaboot/api/metrics` returns every meter in the registry, grouped by name:

```
{metricCount, measurementCount,
 metrics: [{name, description, baseUnit, type,
            measurements: [{tags, statistics: [{name, value}]}]}]}
```

Tag values that look like secrets are masked. Without a `MeterRegistry` the response is
`{metricCount: 0, measurementCount: 0, metrics: []}`.

## Trace list {#trace-list}

`GET /peekaboot/api/traces/insights` returns the newest traces first.

| Parameter | Values | Default | Invalid value |
|---|---|---|---|
| `limit` | 0 to 10000 | `100` | Out of range is clamped. Not a number: `400`. |
| `bucket` | `all`, `errors`, `slow`, any case | `all` | Treated as `all`. |
| `rootActionType` | Comma-separated [root action types](#root-action-types), any case, or `*` | Every type except `CONNECTION_POOL` | Unknown names are dropped. Nothing left means the default. |
| `rootOperation` | Part of the name of the row's root span, any case | none | none |

`rootActionType=*` includes `CONNECTION_POOL`. See [Traces, trace
types]({{ '/docs/traces/' | relative_url }}#root-action-type).

A `rootOperation` with more than two dot-separated segments also matches on its last two. So
`com.acme.ReportJob.run` finds a scheduled task span named `reportJob.run`.

With tracing off, the response has no traces and zero counts.

### Root action types {#root-action-types}

| Value | Root span |
|---|---|
| `HTTP_REQUEST` | An incoming HTTP request. |
| `SCHEDULED_JOB` | A `@Scheduled` method. |
| `MESSAGE_CONSUMER` | A consumed message. |
| `RPC_CALL` | An incoming RPC call. |
| `DATABASE` | A database query outside any other work. |
| `CONNECTION_POOL` | Connection pool maintenance, such as a HikariCP refill. |
| `ASYNC_TASK` | A task run on a Spring task executor, such as an `@Async` method. |
| `INTERNAL` | Other in-process work. |
| `UNKNOWN` | Nothing identifies it, for example while the parent span has not arrived yet. |

See [Traces, root action type]({{ '/docs/traces/' | relative_url }}#root-action-type).

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

### Trace fields {#trace-fields}

List rows and the [single trace](#single-trace) share one shape:

```
{traceId, startTimeMs, durationMs, status, slow, rootActionType, rootOperation,
 rootSpan, summary, httpExchange, logs, queries, subtree, truncated}
```

| Field | Meaning |
|---|---|
| `status` | `HAS_ERRORS` when any span failed, else `OK`. |
| `slow` | `true` when any span has a `SLOW` or `VERY_SLOW` issue. This is the SLOW badge, which is independent of the Slow bucket. See [Traces]({{ '/docs/traces/' | relative_url }}#slow-badge-vs-slow-bucket). |
| `rootOperation` | The name of the row's root span. |
| `rootSpan` | The span tree. `null` until the first span has arrived. |
| `summary` | Counts and durations of the request, spans, queries and logs. |
| `httpExchange` | Request and response details. Always `null` on list rows. |
| `logs`, `queries` | Always arrays. Empty on list rows, filled on the single trace. |
| `subtree` | `null` for a whole trace. On a row for an async task: `{rootSpanId, enclosedByStoredTrace}`. `enclosedByStoredTrace` is `false` when the task's parent span is no longer in the store. |
| `truncated` | `true` when [`max-spans-per-trace`]({{ '/docs/configuration/' | relative_url }}#peekaboottracing) dropped spans. Once set, it stays set. The dashboard shows a `TRUNCATED` badge. |

A row for an async task carries that task's own start time, duration, status and summary.

### Span fields {#span-fields}

Each span is `{spanId, name, kind, startTimeMs, durationMs, status, children, tags, events,
issues, creationOrder, errorMessage, errorClass, remoteServiceName, query, rowCount, logs,
asyncEntry}`.

| Field | Meaning |
|---|---|
| `status` | `OK` or `ERROR`. |
| `issues` | `[{type, message, severity}]`. `type` is `SLOW`, `VERY_SLOW`, `ERROR` or `SLOW_QUERY`; `severity` is `warning` or `error`. See [Traces, issues]({{ '/docs/traces/' | relative_url }}#issues). |
| `errorClass` | Fully qualified class of the last exception recorded on the span. `ERROR` when the span failed without one. `null` on spans that did not fail. |
| `errorMessage` | The span's error description, or the exception message when that is empty. `null` on spans that did not fail. |
| `remoteServiceName` | The remote service the span called, if the instrumentation named one. |
| `query` | The masked SQL of a database query span. A batch is its statements joined by `;` and a newline. `null` on other spans and when no statement was recorded. |
| `rowCount` | Rows returned by a query, where the JDBC instrumentation reported it. |
| `logs` | The span's log entries, without `stackTrace`. The full entries are in the trace's `logs`. |
| `asyncEntry` | `true` on the span that starts an async task. |

A query span without a recorded statement still appears in `queries`, with `sql: null`.

### Log fields {#log-fields}

Each entry in the trace's `logs` is `{spanId, timestamp, level, loggerName, message, threadName,
stackTrace, hiddenFrames, applicationFrames}`.

`stackTrace` is `null` when the log event carried no exception. `hiddenFrames` and
`applicationFrames` are lists of `{start, endExclusive}` line ranges into `stackTrace`. They
mark the framework frames the dashboard folds and your application's own frames.
`hiddenFrames` is empty when [`peekaboot.stack-trace.fold`]({{ '/docs/configuration/' | relative_url }}#peekabootstacktrace)
is off.

## Single trace {#single-trace}

`GET /peekaboot/api/traces/{traceId}/insights` returns one whole trace with its request
details, logs and queries.

- `404` means the store does not hold the trace: the id is unknown or evicted, tracing is off,
  or it was a request to Peekaboot itself.
- `200` with `rootSpan: null` means the request is recorded and its spans are still on the
  way. Poll until `rootSpan` is set. Spans are exported every 200 ms while the dev toolbar is
  on, every 5 s (Spring Boot's default) otherwise.

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
- An unknown level answers `400` with `{"error": "Unknown insights level: 7"}`. A missing
  `level` is a `400` too.

`GET /peekaboot/api/insights/stream` is a Server-Sent Events stream with two events:

| Event | Sent | Data |
|---|---|---|
| `tick` | Every level-0 interval | `{epochMs, values: {seriesId: v}}` |
| `rollup` | When a higher level's interval closes | `{level, epochMs, entries: {seriesId: {min, max, avg, median, p90, p95, p99}}}` |

- A comment heartbeat goes out every 15 seconds.
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
{events: [{type, epochMs, version, branch, commitId, shortCommitId, buildTimeEpochMs, uncleanPrevious}]}
```

- `type` is `start` or `stop`. A stop carries only `type` and `epochMs`.
- A start carries the build fields that changed since the previous start. The first start
  carries all of them.
- `uncleanPrevious` is `true` when the previous run recorded no stop.

`GET /peekaboot/api/lifecycle/runs` returns one entry per run, newest first:

```
{runs: [{startedAtEpochMs, stoppedAtEpochMs, ranForMs, downForMs, version, branch,
         shortCommitId, buildTimeEpochMs, changed, running, uncleanExit}]}
```

- Each row carries its full build info.
- `changed` lists which of `version`, `branch` and `commit` differ from the run before. It is
  `[]` for the oldest run.
- `uncleanExit: true` means the run recorded no stop. `stoppedAtEpochMs` and `ranForMs` are
  then `null`.
- On the `running` row, `stoppedAtEpochMs` is `null` and `ranForMs` is the time so far.
- `downForMs` is `null` when the gap to the previous run is unknown.

See [The dashboard, Lifecycle]({{ '/docs/dashboard/' | relative_url }}#lifecycle).
