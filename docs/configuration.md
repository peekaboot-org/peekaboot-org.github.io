---
title: Configuration
lead: Every peekaboot.* property, grouped by prefix, with its default and what it actually controls.
permalink: /docs/configuration/
---

Every property below is bound by a `@ConfigurationProperties` class, with one exception
noted in its own section. Values shown are the Java field defaults; see [How activation
works]({{ '/docs/how-activation-works/' | relative_url }}) for how `peekaboot.enabled`
itself is actually resolved, and [Auto-configured
defaults]({{ '/docs/auto-configured-defaults/' | relative_url }}) for what Peekaboot sets
*in your application* rather than in itself.

## `peekaboot`

Bound by `PeekabootProperties`.

| Property | Type | Default | Controls |
|---|---|---|---|
| `enabled` | boolean | auto-detected | The master switch for the dashboard, its API, and Peekaboot's own defaults. There is no fixed default: an `EnvironmentPostProcessor` computes one from the launch context and adds it at the lowest property-source precedence, so any value you set &mdash; `application.yml`, an environment variable, a system property &mdash; always wins. See [How activation works]({{ '/docs/how-activation-works/' | relative_url }}). |
| `dev-toolbar` | boolean | `false` | Injects the dev toolbar into HTML responses, and turns on correlated-log capture and full request/response detail capture (headers, body, resolved controller). See [Dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}). |

## `peekaboot.lifecycle`

<div class="pk-callout pk-callout--warning" markdown="1">
**No `@ConfigurationProperties` class backs this prefix.** `enabled` exists only as a
`@ConditionalOnProperty(prefix = "peekaboot.lifecycle", name = "enabled", havingValue =
"true", matchIfMissing = true)` guard on `PeekabootLifecycleAutoConfiguration`. Setting it
works exactly like any other Boot property, but because there's no properties bean behind
it, it will **not** appear on the dashboard's own Config tab &mdash; unlike every other
property on this page.
</div>

| Property | Type | Default | Controls |
|---|---|---|---|
| `enabled` | boolean | `true` | Enables `PeekabootLifecycleAutoConfiguration` &mdash; the application-ready startup summary (build, Git, server and datasource info logged once the app is up). |

## `peekaboot.tracing`

Bound by `PeekabootTracingProperties`.

| Property | Type | Default | Controls |
|---|---|---|---|
| `enabled` | boolean | `true` | Whether the in-memory trace store is created at all. Off, and the Traces tab has nothing to show regardless of what's on the classpath. |
| `max-traces` | int | `1000` | Maximum number of traces held in the **All** bucket (a Caffeine cache sized by entry count). Oldest-evicted once full; also evicted after a fixed 30-minute time-to-live that isn't configurable &mdash; see [Tracing]({{ '/docs/tracing/' | relative_url }}). |
| `max-spans-per-trace` | int | `100` | Maximum spans retained per trace. See below &mdash; this one has real consequences past its default. |
| `max-error-traces` | int | `100` | Maximum traces held in the **Errors** bucket, a separate bounded collection from All. |
| `max-slow-traces` | int | `100` | Maximum traces held in the **Slow** bucket, a separate bounded collection from All. |
| `slow-trace-threshold-ms` | long | `1000` | Total end-to-end duration at or above which a trace qualifies for the Slow bucket. |
| `max-logs-per-trace` | int | `500` | Maximum correlated log entries retained per trace (only populated when the dev toolbar is on). |

### `max-spans-per-trace` deserves more than a table row

The default of 100 spans per trace is a *sliding window*: once a trace's span count
crosses the cap, `TraceDataBundle.addSpan` drops the **oldest** spans to make room for new
ones, as each new span arrives. This happens at write time, in the trace store, before the
trace is ever read.

Span deduplication and issue detection &mdash; including the `HIGH_QUERY_COUNT` check,
which is exactly the warning a query-heavy endpoint should trigger &mdash; run later, only
when a trace is fetched for the list or detail view. By then, truncation has already
happened. An endpoint that emits more than 100 spans in one request &mdash; a query-heavy
one is the obvious case, since every query is its own span &mdash; can lose whole queries
before deduplication or issue detection ever sees them, undercounting query totals and
potentially suppressing the very warning meant to catch it.

Raising `max-spans-per-trace` is the fix, not lowering the query-count thresholds below.
See [Tracing &mdash; Span
deduplication]({{ '/docs/tracing/' | relative_url }}#span-deduplication) for the full
mechanics, and [Concepts]({{ '/docs/concepts/' | relative_url }}) for what
`HIGH_QUERY_COUNT` actually checks.

## `peekaboot.ui.tracing`

Bound by `UiTracingProperties`. These drive the dashboard's issue detection and badges,
not what gets captured &mdash; see [Concepts]({{ '/docs/concepts/' | relative_url }}) for
how each issue type is used.

| Property | Type | Default | Controls |
|---|---|---|---|
| `slow-span-threshold-ms` | long | `100` | A single span's own duration at or above this triggers the SLOW issue and the SLOW badge on its trace row. |
| `very-slow-span-threshold-ms` | long | `500` | A single span's own duration at or above this triggers VERY_SLOW instead of SLOW (checked first; a span never gets both). |
| `slow-query-threshold-ms` | long | `50` | A database query span's duration at or above this triggers the SLOW_QUERY issue. |
| `high-query-count-threshold` | int | `5` | Direct database-query children a single span can have before it triggers HIGH_QUERY_COUNT. |
| `high-trace-query-count-threshold` | int | `20` | Total database queries a whole trace can run before it triggers HIGH_QUERY_COUNT, even if no single span crosses the per-span threshold above. |

## Worked examples

### Memory-constrained

`TraceDataBundle` holds spans and logs in two independent lists, each bounded by its own
cap &mdash; logs are not nested inside spans, so the two caps add rather than multiply. The
All bucket's worst-case entry count is `max-traces` &times; (`max-spans-per-trace` +
`max-logs-per-trace`) &mdash; a Caffeine cache sized by trace count, each trace holding up
to its own span cap plus its own log cap. At the documented defaults (1000 / 100 / 500)
that's 1000 &times; 600 = 600,000 entries, not the 50,000,000 a naive triple product would
suggest. Turning all three down shrinks that ceiling proportionally; the Errors and Slow
buckets are independent, smaller collections, so scale those down too rather than leaving
them at their own defaults:

```yaml
peekaboot:
  tracing:
    max-traces: 200
    max-spans-per-trace: 50
    max-logs-per-trace: 100
    max-error-traces: 25
    max-slow-traces: 25
```

This trades trace depth and history for memory. If your app's requests routinely produce
more than 50 spans, this configuration will truncate them &mdash; see above before
combining it with a query-heavy workload.

### Query-heavy application

An endpoint that legitimately issues dozens of queries by design (a report, a bulk export,
an N+1-shaped-but-intentional fan-out) needs headroom on two axes: enough span capacity
that its queries survive truncation, and thresholds that don't flag its normal behaviour
as an issue on every single request.

```yaml
peekaboot:
  tracing:
    max-spans-per-trace: 500
  ui:
    tracing:
      high-query-count-threshold: 15
      high-trace-query-count-threshold: 60
```

Raise `max-spans-per-trace` first, so the endpoint's queries aren't silently dropped
before deduplication and issue detection ever run &mdash; see above. Only then raise the
UI thresholds, and only as far as reflects what's actually normal for this endpoint; set
them too high and a genuine regression (a query count that grows well past what's normal)
stops triggering HIGH_QUERY_COUNT at all.
