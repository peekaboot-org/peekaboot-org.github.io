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

These are the only five endpoints Peekaboot exposes &mdash; the dashboard and toolbar
call exactly this set, nothing broader.

`/api/features` returns `{tracing, metrics, devToolbar, unmaskingEnabled}` &mdash; the
same call the dashboard uses to decide whether to show its Metrics and Traces tabs, and
whether the Environment/Config tabs' "Show secrets" toggle can appear at all. See [The
dashboard]({{ '/docs/dashboard/' | relative_url }}) for what drives each flag.

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
`configprops`, `scheduledtasks`) and localizes/summarizes them for the given `locale`
(`Locale.ENGLISH` if omitted or blank).

For traces, `insights` enriches the underlying spans: they're assembled into a tree,
duplicate spans from double-instrumented layers are collapsed (see [Configuration &mdash;
`max-spans-per-trace`]({{ '/docs/configuration/' | relative_url }}#max-spans-per-trace-deserves-more-than-a-table-row)),
issues like `SLOW` or `HIGH_QUERY_COUNT` are detected and attached (see
[Concepts]({{ '/docs/concepts/' | relative_url }})), and correlated logs are attached to
the spans that emitted them. Both `GET /peekaboot/api/traces/insights` (the list) and
`GET /peekaboot/api/traces/{traceId}/insights` (the detail) carry a `truncated` boolean
&mdash; `true` only when `max-spans-per-trace` actually dropped real, already-deduplicated
spans for that trace, never merely because duplicate artifacts were folded away. The
dashboard shows this as a `TRUNCATED` badge; see [Configuration &mdash;
`max-spans-per-trace`]({{ '/docs/configuration/' | relative_url }}#max-spans-per-trace-deserves-more-than-a-table-row).

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
