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
| `dev-toolbar` | boolean | auto-detected: on for a local run, off elsewhere | Injects the dev toolbar into HTML responses, and turns on correlated-log capture and full request/response detail capture (headers, query/form parameters, resolved controller &mdash; not body content or uploaded file names, which the trace data model reserves fields for but the capture filter doesn't populate). Computed by the same launch-context detection as `enabled` above, at the same lowest precedence, so any value you set wins either way &mdash; it is **not** keyed on `peekaboot.enabled`, so an application that turns Peekaboot on deliberately in a shared environment does not also get the toolbar. See [Dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}) and [How activation works]({{ '/docs/how-activation-works/' | relative_url }}). |
| `enable-unmasking` | boolean | `false` | Server-side gate for revealing real, unmasked values from the dashboard/API. On its own it changes nothing &mdash; it only makes an `unmask=true` request parameter *possible*, on `GET /peekaboot/api/actuator/all/insights`, and it's what makes the Environment/Config tabs' "Show secrets" toggle appear at all. It does not control whether those tabs' values are readable in the first place &mdash; see the actuator-visibility note below. See [Security &mdash; masking]({{ '/docs/security/' | relative_url }}#masking). |

Actuator value visibility for the Environment and Config tabs follows that same
launch-context detection, not `enable-unmasking` above: `management.endpoint.env.show-values`
and `management.endpoint.configprops.show-values` resolve to `always` only on a local run,
and are left unset otherwise, so Spring's own default (`never`) masks every property
off-local &mdash; `server.port` included, not just recognisable secrets. `enable-unmasking`
is a separate, narrower gate that only matters once a value is visible at all: whether it
can also be *revealed* unmasked. See [Auto-configured
defaults]({{ '/docs/auto-configured-defaults/' | relative_url }}) and [Security &mdash;
`show-values: always` only on a local
run]({{ '/docs/security/' | relative_url }}#show-values-always-only-on-a-local-run).

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
| `enabled` | boolean | `true` | Enables `PeekabootLifecycleAutoConfiguration` &mdash; the application-ready startup summary (application name, build info, server and datasource info logged once the app is up &mdash; no Git info; that reaches the dashboard separately, through the actuator `info` endpoint under `management.info.git.enabled`). |

## `peekaboot.tracing`

Bound by `PeekabootTracingProperties`.

| Property | Type | Default | Controls |
|---|---|---|---|
| `enabled` | boolean | `true` | Whether the in-memory trace store is created at all. Off, and the Traces tab has nothing to show regardless of what's on the classpath. |
| `max-traces` | int | `1000` | Maximum number of traces held in the **All** bucket (a Caffeine cache sized by entry count). Oldest-evicted once full; also evicted after a fixed 30-minute time-to-live that isn't configurable &mdash; see [Tracing]({{ '/docs/tracing/' | relative_url }}). |
| `max-spans-per-trace` | int | `500` | Maximum (deduplicated) spans retained per trace. See below &mdash; this one has real consequences past its default. |
| `max-error-traces` | int | `100` | Maximum traces held in the **Errors** bucket, a separate bounded collection from All. |
| `max-slow-traces` | int | `100` | Maximum traces held in the **Slow** bucket, a separate bounded collection from All. |
| `slow-trace-threshold-ms` | long | `1000` | Total end-to-end duration at or above which a trace qualifies for the Slow bucket. |
| `max-logs-per-trace` | int | `500` | Maximum correlated log entries retained per trace (only populated when the dev toolbar is on). |

### `max-spans-per-trace` deserves more than a table row

`max-spans-per-trace` is a *sliding window* over **deduplicated** spans: `TraceDataBundle`
folds a duplicate span (the same operation double-instrumented by two layers, most
commonly a JDBC driver-level span and a `datasource-proxy`/Micrometer span for the same
query) into its surviving parent as each span is written, before the cap is ever checked.
Only once that folding is done does the cap apply &mdash; if the deduplicated count still
exceeds it, the **oldest** real spans are dropped to make room for new ones. Both happen
at write time, in the trace store, before the trace is ever read.

This means the cap now counts real, distinct work rather than counting a double-tagged
JDBC call as two spans against it &mdash; the previous defect (fixed) let truncation run
*before* deduplication, so the cap bit roughly twice as early as its number suggested.
When the cap genuinely is hit, that's no longer silent: the trace is flagged `truncated`,
surfaced through the API and shown as a badge in the dashboard, so a shortened trace is
never mistaken for a complete one. See [Tracing &mdash; Span
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
to its own span cap plus its own log cap. At the documented defaults (1000 / 500 / 500)
that's 1000 &times; 1000 = 1,000,000 entries, not the 250,000,000 a naive triple product
would suggest. Turning all three down shrinks that ceiling proportionally; the Errors and Slow
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

An endpoint that legitimately issues dozens, or a few hundred, queries by design (a
report, a bulk export, an N+1-shaped-but-intentional fan-out) needs headroom on two axes:
enough span capacity that its queries survive truncation, and thresholds that don't flag
its normal behaviour as an issue on every single request. The default cap (500,
post-deduplication) already covers most such endpoints; if the trace list shows a
`TRUNCATED` badge on this endpoint's traces, raise it further:

```yaml
peekaboot:
  tracing:
    max-spans-per-trace: 1500
  ui:
    tracing:
      high-query-count-threshold: 15
      high-trace-query-count-threshold: 60
```

Raise `max-spans-per-trace` first if truncation is actually happening &mdash; check the
`TRUNCATED` badge before assuming it is, since dedup already keeps the cap from biting on
double-instrumented artifacts. Only then raise the UI thresholds, and only as far as
reflects what's actually normal for this endpoint; set them too high and a genuine
regression (a query count that grows well past what's normal) stops triggering
HIGH_QUERY_COUNT at all.
