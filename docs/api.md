---
title: HTTP API
lead: The /peekaboot/api/** surface the dashboard, toolbar and trace-detail overlay are built on.
permalink: /docs/api/
---

Everything the dashboard shows is available as JSON in its own right.

<div class="pk-callout pk-callout--warning" markdown="1">
Every endpoint below is unauthenticated by default. Peekaboot adds no security of its own,
so anything that can reach `/peekaboot/**` can call these directly and read your
configuration, environment, and request traces. See
[Security]({{ '/docs/security/' | relative_url }}) before exposing this anywhere beyond
your own machine.
</div>

## Endpoints

| Endpoint | Query parameters |
|---|---|
| `GET /peekaboot/api/actuator/all/insights` | `locale`, `unmask` (default `false`) |
| `GET /peekaboot/api/features` | &mdash; |
| `GET /peekaboot/api/metrics` | &mdash; |
| `GET /peekaboot/api/traces/insights` | `limit` (default `100`, clamped to 0&ndash;10000), `bucket`, `rootActionType`, `rootOperation` |
| `GET /peekaboot/api/traces/{traceId}/insights` | &mdash; |
| `GET /peekaboot/api/insights/config` | &mdash; |
| `GET /peekaboot/api/insights/data` | `level` (required) |
| `GET /peekaboot/api/insights/stream` | &mdash; (Server-Sent Events, not JSON) |
| `GET /peekaboot/api/lifecycle/events` | &mdash; |
| `GET /peekaboot/api/lifecycle/runs` | &mdash; |

These are the only ten endpoints Peekaboot exposes &mdash; the dashboard and toolbar
call exactly this set, nothing broader. The dashboard UI itself &mdash; its HTML, JS and
CSS &mdash; is served separately, under `/peekaboot/**` too; see [The
dashboard]({{ '/docs/dashboard/' | relative_url }}).

<div class="pk-callout" markdown="1">
**Two unrelated things are called `insights` here.** `/api/*/insights` is a *suffix*
naming the enriched, ready-to-render form of actuator or trace data: the server shapes it
for the screen that shows it, so the browser renders rather than computes (a
backend-for-frontend). `/api/insights/**` is a *prefix* naming the metric-charts feature
and nothing else. They share a word and no code.
</div>

`/api/features` returns `{tracing, metrics, devToolbar, unmaskingEnabled, insights}`
&mdash; the same call the dashboard uses to decide whether to show its Insights, Meters
and Traces tabs, and whether the Environment/Config tabs' "Show secrets" toggle can appear
at all. `metrics` is the flag behind the tab labelled **Meters** &mdash; the JSON field and
the tab label differ. See [The dashboard]({{ '/docs/dashboard/' | relative_url }}) for
what drives each flag.

`unmask=true` only has an effect while `peekaboot.enable-unmasking=true` is also set on
the server; without that property, the parameter is silently ignored and the response
stays masked. See [Security &mdash; masking]({{ '/docs/security/' | relative_url }}#masking)
for the full two-opt-in design and what gets masked in the first place. `enable-unmasking`
governs only this reveal step; it has no bearing on whether the Environment/Config tabs'
underlying values are readable at all &mdash; see [Security &mdash; actuator value
visibility]({{ '/docs/security/' | relative_url }}#show-values-always-only-on-a-local-run)
for what does.

`rootActionType` accepts a comma-separated list of root action types (case-insensitive;
unrecognized tokens are silently dropped rather than rejected). `rootOperation` matches
against the trace's root operation name, partially and case-insensitively. See
[Concepts]({{ '/docs/concepts/' | relative_url }}) for what a root action type and root
operation are.

## What `insights` adds

`GET /peekaboot/api/actuator/all/insights` invokes exactly the seven Actuator endpoints
the dashboard's tabs are built on (`health`, `info`, `env`, `loggers`, `flyway`,
`configprops`, `scheduledtasks`) and localizes/summarizes them for the given `locale`.

### The `locale` parameter

`locale` is an IETF BCP 47 language tag such as `de-DE` (the underscore form, `de_DE`, is
accepted too); omitted or blank means English. It decides the language of the cron
descriptions in the scheduled-tasks part of the payload and of the display names of the
server's timezone and default locale &mdash; nothing else in the response depends on it.
The dashboard's language selector sends one of `en-US`, `de-DE`, `fr-FR` or `es-ES`; see
[The dashboard &mdash; the header]({{ '/docs/dashboard/' | relative_url }}#the-header).

For traces, `insights` enriches the underlying spans: they're assembled into a tree,
duplicate spans from double-instrumented layers are folded into one, issues like `SLOW` or
`HIGH_QUERY_COUNT` are detected and attached (see
[Concepts]({{ '/docs/concepts/' | relative_url }})), and correlated logs are attached to
the spans that emitted them. Both `GET /peekaboot/api/traces/insights` (the list) and
`GET /peekaboot/api/traces/{traceId}/insights` (the detail) carry a `truncated` boolean
&mdash; `true` only when
[`max-spans-per-trace`]({{ '/docs/configuration/' | relative_url }}#peekaboottracing)
dropped distinct spans for that trace, never merely because duplicates were folded away.
The dashboard shows this as a `TRUNCATED` badge.

## The `bucket` parameter

`bucket` accepts `all`, `errors`, or `slow` (case-insensitive), matching the three trace
buckets described in [Tracing]({{ '/docs/tracing/' | relative_url }}). It defaults to
`all`, and &mdash; unlike an invalid `rootActionType` token, which is silently dropped
&mdash; an unrecognized or blank `bucket` value also falls back to `all` rather than
producing an error response. There's no way to make `GET /peekaboot/api/traces/insights`
400 on a bad `bucket`.

## `limit`

`limit` defaults to `100` and is clamped to the range 0&ndash;10000 regardless of what's
passed: a negative value is raised to `0`, and a very large one is capped at `10000`,
rather than either producing an error. A `limit` of `0` returns an empty trace list, not
an error.

## The single-trace endpoint and 404

`GET /peekaboot/api/traces/{traceId}/insights` returns `404 Not Found` until that trace id
has at least one span recorded in the store &mdash; that is, until the trace's first span
has actually been exported into Peekaboot. If you already have a trace id (from a
`Server-Timing` header, a toolbar bar, or a list endpoint) and query it immediately, a
brief `404` before the store catches up is expected, not a bug; retry rather than treating
it as "this trace doesn't exist."

## The insights endpoints

The three `/api/insights/**` endpoints back the Insights tab. All the grouping, ordering
and merging is done server-side, so a client renders what `/config` hands it rather than
deciding anything itself. See [Insights]({{ '/docs/insights/' | relative_url }}) for the
panel file these are driven by.

`GET /peekaboot/api/insights/config` returns the levels (`index`, `intervalMs`, `size`),
the enabled panels in final display order (`id`, `title`, `chart`, `unit`, an optional
per-panel `level`, and their series), and the tiles with their current values. Series ids
arrive namespaced as `<panelId>.<seriesId>`, which is also how they're keyed in `/data` and
in the stream &mdash; a bare series id from the YAML file is only unique within its panel.

`GET /peekaboot/api/insights/data?level=n` returns one level's whole ring:
`{level, intervalMs, endEpochMs, count, series}`. For level 0 each series carries a
`values` array of raw ticks; for levels above it, a `stats` object keyed by `min`, `max`,
`avg`, `median`, `p90`, `p95`, `p99`, each with its own array. Whichever doesn't apply is
`null`. There are no timestamps in the arrays &mdash; positions are derived from
`endEpochMs` and `intervalMs`, and a missing sample is `null` (JSON has no `NaN`).

An unknown `level` is the one insights call that returns `400`, as
`{"error": "Unknown insights level: 7"}`. A missing `level` parameter is a `400` from
Spring itself.

`GET /peekaboot/api/insights/stream` is Server-Sent Events, not JSON &mdash; hold it open
rather than polling it. Two named events arrive:

| Event | When | Payload |
|---|---|---|
| `tick` | every level-0 interval | `{epochMs, values: {seriesId: v}, tiles: {tileId: v}}` |
| `rollup` | when a higher level's window closes | `{level, epochMs, entries: {seriesId: {min, max, avg, median, p90, p95, p99}}}` |

A comment heartbeat goes out every 15 seconds to keep proxies from reaping an idle
connection. There's no event replay: reconnect with the browser's native `EventSource`
retry and refetch `/data` for the levels you care about. The stream completes cleanly on
application shutdown rather than being dropped.

## The lifecycle endpoints

The two `/api/lifecycle/**` endpoints back the Lifecycle tab and the restart markers on
the Insights charts. Both exist while `peekaboot.lifecycle.enabled` is `true` (the
default); with it `false` they are absent, and the tab says so. How far back they reach
is [`peekaboot.storage.enabled`]({{ '/docs/configuration/' | relative_url }}#peekabootstorage):
with storage off, the log holds the current run alone.

`GET /peekaboot/api/lifecycle/events` returns the raw start/stop log, oldest first:
`{events: [{type, epochMs, version, branch, commitId, shortCommitId, buildTimeEpochMs,
uncleanPrevious}]}`. `type` is `"start"` or `"stop"`. A start's build fields are only
populated where they differ from the previous start (the first start in the log carries
all of them); `uncleanPrevious` is `true` on a start whose predecessor recorded no stop.

`GET /peekaboot/api/lifecycle/runs` returns the same history folded into one entry per
run, newest first: `{runs: [{startedAtEpochMs, stoppedAtEpochMs, ranForMs, downForMs,
version, branch, shortCommitId, buildTimeEpochMs, changed, running, uncleanExit}]}`. Here
every row is self-contained &mdash; the build fields are carried forward from the last
start that reported them &mdash; and `changed` lists which of `"version"`, `"branch"` and
`"commit"` differ from the run before. `stoppedAtEpochMs` and `ranForMs` are `null` when
`uncleanExit` is `true`; `downForMs` is `null` when the gap to the previous run is
unknowable. See [The dashboard &mdash; Lifecycle]({{ '/docs/dashboard/' | relative_url }}#lifecycle)
for how these render.
