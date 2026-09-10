---
title: HTTP API
lead: The /peekaboot/api/** surface the dashboard, toolbar and trace-detail overlay are built on.
permalink: /docs/api/
---

<div class="pk-callout pk-callout--warning" markdown="1">
Every endpoint below is unauthenticated by default. Peekaboot adds no security of its own,
so anything that can reach `/peekaboot/**` can read your configuration, environment and
request traces. See [Security]({{ '/docs/security/' | relative_url }}) before exposing this
beyond your own machine.
</div>

Nulls travel on the wire. Peekaboot does not suppress them, so every optional field below
is present as `null`, never missing.

## Endpoints

| Endpoint | Query parameters |
|---|---|
| `GET /peekaboot/api/actuator/all/insights` | `locale`, `unmask` (default `false`) |
| `GET /peekaboot/api/features` | none |
| `GET /peekaboot/api/metrics` | none |
| `GET /peekaboot/api/traces/insights` | `limit` (default `100`, clamped to 0&ndash;10000), `bucket`, `rootActionType`, `rootOperation` |
| `GET /peekaboot/api/traces/{traceId}/insights` | none |
| `GET /peekaboot/api/insights/config` | none |
| `GET /peekaboot/api/insights/data` | `level` (required) |
| `GET /peekaboot/api/insights/stream` | none (Server-Sent Events, not JSON) |
| `GET /peekaboot/api/lifecycle/events` | none |
| `GET /peekaboot/api/lifecycle/runs` | none |

That table is the whole API. The dashboard's own HTML, JS and CSS come from
`/peekaboot/ui/**`; `/peekaboot` and `/peekaboot/` both redirect to
`/peekaboot/ui/dashboard/index.html`. See [The
dashboard]({{ '/docs/dashboard/' | relative_url }}).

Every one answers with `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`, the
SSE stream and the single-trace `404` included. An unmapped path under `/peekaboot/api/`
gets Spring's own 404 without them.

<div class="pk-callout" markdown="1">
**Two unrelated things are called `insights` here.** `/api/*/insights` is a *suffix*,
naming the enriched, ready-to-render form of actuator or trace data, shaped server-side so
the browser renders rather than computes. `/api/insights/**` is a *prefix*, the
metric-charts feature. They share a word and no code.
</div>

## `/api/features`

In wire order: `tracing`, `tracingSpansPossible`, `metrics`, `devToolbar`,
`unmaskingEnabled`, `insights`, `slowSpanThresholdMs`, `verySlowSpanThresholdMs`,
`slowQueryThresholdMs`, `slowTraceThresholdMs`, `maskLiteral`.

The boolean flags drive the dashboard's Insights, Meters and Traces tabs, and whether the
Environment/Config tabs' "Show secrets" toggle appears. `metrics` is the flag behind the
tab labelled **Meters**: the JSON field and the tab label differ. See [The
dashboard]({{ '/docs/dashboard/' | relative_url }}) for what sets each flag.

`tracingSpansPossible` is narrower than `tracing`. `tracing` says the trace store exists;
`tracingSpansPossible` says whether anything is wired to fill it. `false` is a hard
guarantee that no span can arrive, because the host has no OpenTelemetry SDK on its class
path. `true` does not promise that spans will arrive. Sampling and the rest of the host's
tracing setup stay outside Peekaboot's view. The field is meaningless while `tracing` is
`false`, since there is no store for a span to reach.

The threshold fields are the effective values the backend detects issues and fills the Slow
bucket with (see
[Configuration, `peekaboot.ui.tracing`]({{ '/docs/configuration/' | relative_url }}#peekabootuitracing)),
published so the frontend keeps no copy. `slowTraceThresholdMs` is `null` while tracing is
off, since the Slow bucket doesn't exist then. `maskLiteral` is the string masked values are
replaced with (`******`); the trace detail's Request tab compares header values against it
to highlight what was masked.

## The `unmask` parameter

`unmask=true` works only while `peekaboot.enable-unmasking=true` is also set on the server;
without it the parameter is ignored and the response stays masked. See [Security,
masking]({{ '/docs/security/' | relative_url }}#masking) for the two-opt-in design and what
gets masked.

## Filtering the trace list

No parameter on `GET /peekaboot/api/traces/insights` can make it fail:

- `bucket` takes `all`, `errors` or `slow`, case-insensitive, matching the three [trace
  buckets]({{ '/docs/traces/' | relative_url }}#the-three-buckets). Blank or unrecognised
  falls back to `all`.
- `limit` defaults to `100`, clamped to 0 to 10000: negative becomes `0`, larger becomes
  `10000`. `limit=0` returns an empty list. The dashboard's Traces tab asks for 50.
- `rootActionType` takes a comma-separated list of [root action
  types]({{ '/docs/traces/' | relative_url }}#root-action-type), case-insensitive,
  unrecognised tokens dropped silently.
- `rootOperation` matches the trace's root operation name, partially and
  case-insensitively.

A request that names no recognisable type (absent, blank, or only unknown tokens) gets a
**default view**: every type except `CONNECTION_POOL`, the routine pool maintenance
[Traces]({{ '/docs/traces/' | relative_url }}#what-gets-captured) describes. The single
value `*` asks for every type, hidden ones included. There is no value that asks for
nothing.

`rootOperation` has a second rule for scheduled tasks. A filter of more than two
dot-separated segments also matches an operation holding just its last two, so
`com.acme.ReportJob.run` matches a span named `reportJob.run`. That lets the Scheduled
Tasks tab link to a task's traces by its fully-qualified target.

## What `insights` adds

`GET /peekaboot/api/actuator/all/insights` returns `{application, runtime, dataSources,
health, environment, loggers, flyway, config, scheduledTasks, server}`.

Most of it is Actuator data: `info`, `env`, `loggers`, `flyway`, `configprops` and
`scheduledtasks`, read through endpoint objects Peekaboot builds itself and calls
in-process, which is why `management.endpoints.web.exposure` needs no configuration and
`show-values` has no effect. `health` is the one endpoint borrowed from the application,
read directly so that `management.endpoint.health.show-details` cannot strip the
components. A source with nothing behind it (no Flyway bean, say) is absent from the
payload; one that fails leaves the rest intact.

`runtime`, `dataSources` and `server` are not Actuator data. Peekaboot collects those
itself. The Boot and Framework versions travel inside `application`, alongside the `build`
and `git` maps that do come from Actuator's `info`.

### The `locale` parameter

`locale` is an IETF BCP 47 language tag such as `de-DE` (the underscore form, `de_DE`, is
accepted too); omitted or blank means English. It sets the language of the cron
descriptions in the scheduled-tasks payload and of the display names of the server's
timezone and default locale. Nothing else in the response depends on it. The dashboard's
language selector sends one of `en-US`, `de-DE`, `fr-FR` or `es-ES`; see [The dashboard,
the header]({{ '/docs/dashboard/' | relative_url }}#the-header).

A task carries `{target, type, schedule, scheduleDescription, intervalMs, lastExecution,
lastStatus, lastException, nextExecution}`, `type` being `CRON`, `FIXED_DELAY` or
`FIXED_RATE`. `schedule` holds the cron expression alone. For a fixed-rate or fixed-delay
task it is `null` and the interval travels as `intervalMs`, formatted by the dashboard
rather than the server.

### Trace insights

For traces, `insights` assembles the spans into a tree, folds duplicates from
double-instrumented layers into one, detects and attaches issues like `SLOW` or
`SLOW_QUERY` (see [Traces]({{ '/docs/traces/' | relative_url }}#issues)), and attaches
correlated logs to the spans that emitted them.

The list response is `{traces, bucketCounts, filteredBucketCounts}`, each count being
`{all, errors, slow}`. `bucketCounts` is what the store holds; `filteredBucketCounts` is
what the request admits, and it is `null` only for a request that filters nothing
(`rootActionType=*` with no `rootOperation`, or a response served with tracing off). The
default view is itself a filter, so an ordinary request carries both numbers.

Each trace, in the list and as the detail response, is the same shape: `{traceId,
startTimeMs, durationMs, status, slow, rootActionType, rootOperation, rootSpan, summary,
httpExchange, logs, queries, truncated}`. `slow` is `true` when any span carries a `SLOW`
or `VERY_SLOW` issue, the badge and not the Slow bucket (see
[Traces]({{ '/docs/traces/' | relative_url }}#the-slow-badge-is-not-the-slow-bucket)).
`logs` and `queries` are always arrays, never `null`: empty on a list row, populated only
by the detail endpoint. `truncated` is `true` only when
[`max-spans-per-trace`]({{ '/docs/configuration/' | relative_url }}#peekaboottracing)
dropped distinct spans, never because duplicates were folded away. The dashboard shows it
as a `TRUNCATED` badge.

A database-query span (a CLIENT-kind span carrying `db.*` or `jdbc.query*` tags) also
carries `query`, the masked SQL it ran. It is `null` when the instrumentation recorded no
statement; the span still counts as a query and appears in `queries` with
`sql: null`. A batched span, carrying `jdbc.query[N]` tags rather than a single statement,
is one query whose statements are joined by a semicolon and a newline, in index order.

A span that failed carries `errorClass` and `errorMessage`; on every other span both are
present and `null`. `errorClass` is the exception's fully-qualified class name, from the
last exception event recorded on the span; a span marked as failed without one carries the
literal `ERROR`. `errorMessage` is the span status's description, falling back to the
exception's message when that description is empty.

### The single-trace endpoint and 404

The store opens a bundle for a trace on the first thing it hears about it: a span, a log
line, or the completed request. The request lands first, published as the response
finishes, roughly 200 ms before the first span export. So querying the id of a
request you were just served returns `200` with `rootSpan: null`, a zeroed `summary` and
empty `logs` and `queries`, filling in a moment later. The toolbar retries while `rootSpan`
is null, not on a non-OK status.

`404 Not Found` means the store has never seen the id: unknown, already evicted, tracing
off, or discarded because it was Peekaboot's own. With a trace id from a `Server-Timing`
header, a toolbar bar or a list endpoint, retry rather than treating it as "this trace
doesn't exist".

## The insights endpoints

The `/api/insights/**` endpoints back the Insights tab. Grouping, ordering and
merging happen server-side, so a client renders what `/config` hands it. See
[Insights]({{ '/docs/insights/' | relative_url }}) for the panel file behind them.

`GET /peekaboot/api/insights/config` returns the levels (`index`, `intervalMs`, `size`),
the enabled panels in final display order (`id`, `title`, `chart`, `unit`, an optional
per-panel `level`, and their series), and the tiles (`id`, `label`, `format`, `live`,
`value`). Series ids arrive namespaced as `<panelId>.<seriesId>`, which is also how `/data`
and the stream key them; a bare series id from the YAML file is only unique within its
panel.

`GET /peekaboot/api/insights/data?level=n` returns one level's whole ring:
`{level, intervalMs, endEpochMs, count, series}`. For level 0 each series carries a
`values` array of raw ticks; above it, a `stats` object keyed by `min`, `max`, `avg`,
`median`, `p90`, `p95`, `p99`, each with its own array. Whichever doesn't apply is `null`.
The arrays carry no timestamps: positions derive from `endEpochMs` and `intervalMs`, and a
missing sample is `null`, since JSON has no `NaN`.

An unknown `level` is the one insights call that returns `400`, as
`{"error": "Unknown insights level: 7"}`. A missing `level` parameter is a `400` from
Spring itself.

`GET /peekaboot/api/insights/stream` is Server-Sent Events, not JSON, so hold it open
rather than poll it. Two named events arrive:

| Event | When | Payload |
|---|---|---|
| `tick` | every level-0 interval | `{epochMs, values: {seriesId: v}}` |
| `rollup` | when a higher level's window closes | `{level, epochMs, entries: {seriesId: {min, max, avg, median, p90, p95, p99}}}` |

A comment heartbeat goes out every 15 seconds so proxies don't reap an idle connection. At
most 32 streams are open at once; past that a request gets a `503`, so retry later. A
subscriber that stops reading is dropped once its outbound queue fills, its connection
closing at the timeout. The server closes every stream after 5 minutes, and the browser's
native `EventSource` reconnects on its own. There is no replay: after a reconnect, refetch
`/data` for the levels you care about. Streams complete cleanly on shutdown.

## The lifecycle endpoints

The `/api/lifecycle/**` endpoints back the Lifecycle tab and the restart markers on the
Insights charts. Both exist while `peekaboot.lifecycle.enabled` is `true` (the default);
with it `false` they are absent, and the tab says so. How far back they reach is
[`peekaboot.storage.enabled`]({{ '/docs/configuration/' | relative_url }}#peekabootstorage).
With storage off the log holds the current run alone; the event cap stated there applies
either way.

`GET /peekaboot/api/lifecycle/events` returns the raw start/stop log, oldest first:
`{events: [{type, epochMs, version, branch, commitId, shortCommitId, buildTimeEpochMs,
uncleanPrevious}]}`. `type` is `"start"` or `"stop"`, and a stop carries nothing else. A
start's build fields are populated only where they differ from the previous start, so the
first start carries all of them. `uncleanPrevious` is `true` on a start whose predecessor
recorded no stop, and `false` on the first start, which has none.

`GET /peekaboot/api/lifecycle/runs` returns the same history folded into one entry per run,
newest first: `{runs: [{startedAtEpochMs, stoppedAtEpochMs, ranForMs, downForMs, version,
branch, shortCommitId, buildTimeEpochMs, changed, running, uncleanExit}]}`. Every row is
self-contained, its build fields carried forward from the last start that reported them,
and `changed` lists which of `"version"`, `"branch"` and `"commit"` differ from the run
before (`[]`, never `null`, for the oldest run). `stoppedAtEpochMs` and `ranForMs` are both
`null` when `uncleanExit` is `true`; on a `running` row `stoppedAtEpochMs` is `null` while
`ranForMs` counts the time elapsed so far. `downForMs` is `null` when the gap to the
previous run is unknowable. See [The dashboard,
Lifecycle]({{ '/docs/dashboard/' | relative_url }}#lifecycle) for how these render.
