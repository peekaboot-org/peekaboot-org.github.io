---
title: Configuration
lead: Every peekaboot.* property, grouped by prefix, with its default and what it actually controls.
permalink: /docs/configuration/
---

Every property below is bound by a `@ConfigurationProperties` class, with one exception
noted in its own section. See [How activation
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

## `peekaboot.storage`

Bound by `PeekabootProperties.Storage`. The only prefix on this page that touches the
filesystem: it decides whether the insights history and the start/stop log outlive a
restart. Everything else Peekaboot holds is in memory, and is gone when the process is.

| Property | Type | Default | Controls |
|---|---|---|---|
| `enabled` | boolean | auto-detected: on for a local run, off elsewhere | Whether anything is written at all. Computed by the same launch-context detection as `peekaboot.enabled` and `peekaboot.dev-toolbar`, at the same lowest precedence, so any value you set wins either way &mdash; and, like the toolbar, it is **not** keyed on `peekaboot.enabled`: an application that turns Peekaboot on deliberately in a shared environment writes nothing to that host's disk. While it is off, both stores run from memory and never open a file. |
| `dir` | String | unset &mdash; resolves to `${user.home}/.peekaboot/<groupId>.<artifactId>` | Where those files live. An explicit value is used verbatim &mdash; no per-application subdirectory is appended to it. |

The default directory sits deliberately outside your project: it survives a `mvn clean`
and a re-clone, and never lands inside the repository you're working in.
`<groupId>.<artifactId>` is read from `build-info.properties`, so it is only available in
a build that generates one &mdash; the Spring Boot Maven plugin's `build-info` goal, or
`springBoot { buildInfo() }` with the Gradle plugin. Without it Peekaboot falls back to
`spring.application.name`, and to a fixed `application` folder when there is no name
either; two applications that share a name, or have none, then share a directory, which is
the case worth setting `dir` for. Whatever the identifier, anything in it that isn't a
letter, digit, dot, underscore or dash becomes a dash before it names a folder.

Two files land there:

| File | What it holds | Size |
|---|---|---|
| `insights.snapshot` | The insights ring buffers in a versioned binary format, written at each `peekaboot.insights.persistence.interval` boundary and once more at shutdown | The same arithmetic as the rings in memory, plus one column per aggregated level &mdash; about 5 MB at the default levels |
| `lifecycle.jsonl` | The application's start and stop history: one JSON object per line, at most 1000 events, oldest dropped first | &le; 400 KB when full |

Neither file is a source of truth, and neither can fail your application. A snapshot that
is unreadable, was written by a different schema version, no longer matches your
`peekaboot.insights.levels` geometry, or is older than
`peekaboot.insights.persistence.max-age` is discarded and the rings start empty &mdash;
exactly as they would with storage off. A `lifecycle.jsonl` line that fails to parse is
skipped and the rest of the file still loads. Each store creates its directory on first
write and, if that or the write itself throws, logs once and carries on in memory rather
than taking the application down over an unwritable `$HOME`.

Both stores assume one application instance per directory. Two instances pointed at the
same `dir` overwrite each other's files &mdash; the cost is lost history rather than
corruption, but give each instance its own `dir` if you run several against one home
directory.

## `peekaboot.lifecycle`

<div class="pk-callout pk-callout--warning" markdown="1">
**No `@ConfigurationProperties` class backs this prefix.** Setting it works exactly like
any other Boot property, but it will **not** appear on the dashboard's own Config tab
&mdash; unlike every other property on this page.
</div>

| Property | Type | Default | Controls |
|---|---|---|---|
| `enabled` | boolean | `true` | Enables `PeekabootLifecycleAutoConfiguration` &mdash; the application-ready startup summary (application name, build info, server, dashboard and datasource info logged once the app is up &mdash; no Git info; that reaches the dashboard separately, through the actuator `info` endpoint under `management.info.git.enabled`), the matching `ApplicationStopped` summary logged at shutdown with the uptime and the start and stop timestamps, and the run history behind the Lifecycle tab and its `/peekaboot/api/lifecycle/**` endpoints. |

### The URLs in the summary

Three lines of the summary are links, each printed only when it actually leads somewhere:

```
 Service URL: http://localhost:8080
 Swagger UI: http://localhost:8080/swagger-ui.html
 Peekaboot Dashboard: http://localhost:8080/peekaboot/
```

**Service URL** appears whenever the application runs an embedded web server, and every
line below it is built from that base &mdash; `https` when `server.ssl.enabled` is set,
the port the server actually bound to, and `server.servlet.context-path` appended when
one is configured. A `server.address` of `0.0.0.0`, or none at all, is printed as
`localhost`, since the wildcard bind address is not something you can click.

**Swagger UI** appears when springdoc is on the classpath, honouring
`springdoc.swagger-ui.path` when you have moved it.

**Peekaboot Dashboard** appears only when the dashboard is actually being served &mdash;
the same three conditions that activate Peekaboot's web layer at all: a servlet
application, Actuator on the classpath, and `peekaboot.enabled` true. Off, non-servlet,
or no Actuator, and the line is omitted rather than printed as a URL that would 404. See
[How activation works]({{ '/docs/how-activation-works/' | relative_url }}).

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

`max-spans-per-trace` is a *sliding window* over **deduplicated** spans. When the same
operation is double-instrumented by two layers &mdash; most commonly a JDBC driver-level
span and a `datasource-proxy`/Micrometer span for the same query &mdash; Peekaboot folds
the duplicate into its surviving parent before the cap is ever checked. Only once that
folding is done does the cap apply: if the deduplicated count still exceeds it, the
**oldest** real spans are dropped to make room for new ones.

This means the cap counts real, distinct work rather than counting a double-tagged JDBC
call as two spans against it. When the cap genuinely is hit, it isn't silent: the trace is
flagged `truncated`,
surfaced through the API and shown as a badge in the dashboard, so a shortened trace is
never mistaken for a complete one. See [Concepts]({{ '/docs/concepts/' | relative_url }})
for what `HIGH_QUERY_COUNT` actually checks.

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

## `peekaboot.insights`

Bound by `InsightsProperties`. These control the metric collector behind the Insights tab
&mdash; how often it samples and how much history it keeps. Whether that history outlives
the process is `peekaboot.storage.enabled` above. *What* it samples comes from a separate
YAML file rather than from properties; see
[Insights]({{ '/docs/insights/' | relative_url }}#configuring-panels).

| Property | Type | Default | Controls |
|---|---|---|---|
| `enabled` | boolean | `true` | Whether the collector, the `/api/insights/**` endpoints and the Insights tab exist at all. Also needs a Micrometer `MeterRegistry` bean &mdash; without one nothing is wired up regardless of this flag. |
| `levels[n].interval` | Duration | `10s`, `1m`, `1h` | The sampling tick (level 0) and each aggregation window above it. Every interval must be a whole multiple of the previous one, or startup fails. |
| `levels[n].size` | int | `90`, `1440`, `720` | Ring buffer entries kept per series at that level &mdash; `interval` &times; `size` is how far back the charts reach. |
| `config-location` | String | unset | A Spring resource location for the panel file, replacing the default lookup of `peekaboot-insights.yml` on the classpath root. |
| `persistence.interval` | Duration | the coarsest level's own `interval` &mdash; `1h` at the defaults | How often the rings are written to `insights.snapshot`. Does nothing while `peekaboot.storage.enabled` is off. |
| `persistence.max-age` | Duration | the coarsest level's span, `interval` &times; `size` &mdash; 30 days at the defaults | How old a snapshot may be and still be worth loading. Past it every restored sample would be an empty gap, so the file is discarded instead of read. |

Setting `levels` replaces the whole list rather than merging into it, so give every level
you want. Level 0 stores one number per series per tick; every higher level stores seven
(min, max, avg, median, p90, p95, p99), which is what makes the memory arithmetic worth
checking &mdash; Peekaboot logs the result at startup. See [Insights &mdash; what it
costs]({{ '/docs/insights/' | relative_url }}#what-it-costs).

## Worked examples

### A longer, coarser insights history

The defaults reach back 15 minutes at 10-second resolution, 24 hours at one minute, and 30
days at one hour, for roughly 4.5 MB. To watch a long-running local session without paying
for month-scale history, drop the top level and lengthen the middle one:

```yaml
peekaboot:
  insights:
    levels:
      - interval: 10s
        size: 360      # 1 hour of tick resolution
      - interval: 2m
        size: 2160     # 3 days
```

That's 39 &times; (360 + 2160&times;7) &times; 8 &asymp; 4.6 MB &mdash; about what the
defaults cost, spent differently. Sampling more often is the expensive axis: halving
`interval` on level 0 without halving its `size` doubles that level's memory and doubles
how often every meter is read.

### Memory-constrained

Spans and logs are capped independently per trace, and the two caps add rather than
multiply. The All bucket's worst-case entry count is `max-traces` &times;
(`max-spans-per-trace` + `max-logs-per-trace`). At the documented defaults (1000 / 500 /
500) that's 1000 &times; 1000 = 1,000,000 entries, not the 250,000,000 a naive triple
product would suggest. Turning all three down shrinks that ceiling proportionally; the
Errors and Slow buckets are independent, smaller collections, so scale those down too
rather than leaving them at their own defaults:

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
