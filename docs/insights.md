---
title: Insights
lead: Live charts over the Micrometer meters your application already publishes, kept in memory inside your process.
permalink: /docs/insights/
---

The Insights tab charts CPU, memory, garbage collection, threads, HTTP, the connection pool,
JDBC, repositories, transactions, disk space and log events. It keeps up to 30 days of history
at three resolutions, in memory, inside your application. You can switch on more panels or add
your own.

{% include screenshot.html name="dashboard-insights" %}

## When the tab appears {#when-the-tab-appears}

<span id="when-the-tab-isnt-there"></span>The tab appears when the dashboard does,
`peekaboot.insights.enabled` is on (the default) and a Micrometer `MeterRegistry` bean exists.
See [The dashboard, which tabs appear]({{ '/docs/dashboard/' | relative_url }}#conditionally-shown-tabs).

## The default panels {#the-default-panels}

These panels are on by default, in display order. A panel whose meters do not exist (no Hikari
pool, no Hibernate, no `datasource-micrometer`) shows "No data".

| Panel | id | Meters |
|---|---|---|
| CPU usage | `cpu` | `process.cpu.usage`, `system.cpu.usage`, `jvm.gc.overhead` |
| System load | `load` | `system.load.average.1m`, `system.cpu.count` |
| Heap memory | `heap` | `jvm.memory.*{area=heap}` |
| Non-heap memory | `nonheap` | `jvm.memory.*{area=nonheap}` |
| Garbage collection | `gc` | `jvm.gc.pause` |
| Threads | `threads` | `jvm.threads.*` |
| HTTP throughput | `http-throughput` | `http.server.requests` |
| HTTP latency | `http-latency` | `http.server.requests` |
| HTTP in flight | `http-active` | `http.server.requests.active` |
| DB pool | `db-pool` | `hikaricp.connections*` |
| DB pool timing | `db-pool-timing` | `hikaricp.connections.acquire`, `.usage` |
| JDBC queries | `jdbc-queries` | `jdbc.query` |
| Repositories | `repositories` | `spring.data.repository.invocations` |
| Transactions | `transactions` | `hibernate.transactions` |
| Disk space | `disk` | `disk.free`, `disk.total` |
| Log events | `log-events` | `logback.events` |

The HTTP panels show only your application's own traffic. Peekaboot keeps its own requests
out of `http.server.requests` and `http.server.requests.active`.

These ship switched off. Enable them by id, as shown under
[Customise the panels](#configuring-panels): `thread-states` (Thread states),
`hibernate-activity` (Hibernate activity), `executors` (Executors), `open-files` (Open files),
`tomcat-sessions` (Tomcat sessions) and `allocation` (Memory allocation).

A meter no panel names is not collected.

JPA applications get the Transactions and Hibernate activity panels with no extra dependency.

<div class="pk-callout pk-callout--warning" markdown="1">
Peekaboot sets `spring.jpa.properties[hibernate.generate_statistics]=true`, which adds overhead
to every session. Set it to `false` in your own configuration to turn it off; Transactions and
Hibernate activity then show "No data".
</div>

## Levels and memory cost {#levels}

Insights keeps each series at several levels, each an `interval` and a `size` (entries per
series). The default levels cover 15 minutes at 10 seconds, 24 hours at 1 minute and 30 days at
1 hour. `peekaboot.insights.levels` replaces them, and the rules a list of levels must follow
are under [Configuration]({{ '/docs/configuration/' | relative_url }}#peekabootinsights), with
the other `peekaboot.insights.*` properties.

### What it costs {#what-it-costs}

Memory grows with the number of series the enabled panels draw and with the level sizes.
{% include facts/insights-memory.md -%}
Peekaboot logs the real figure at startup:

```
Peekaboot insights: <series> series across <panels> panels, levels [10s x90, 1m x1440, 1h x720], ring buffers ~<size>, persisted across restarts
```

`, persisted across restarts` appears only while storage is on. Enabling more panels, raising a
`size` or adding a level all raise the figure.

## History across restarts {#surviving-a-restart}

With [`peekaboot.storage.enabled`]({{ '/docs/configuration/' | relative_url }}#peekabootstorage)
on, the default for a local run, the history is saved to disk and loaded at the next start.
The downtime shows as a gap, and every start and stop appears as a restart marker, as on the
[Lifecycle tab]({{ '/docs/dashboard/' | relative_url }}#lifecycle).

History is written every minute (`persistence.interval`) and at shutdown, so a crash loses
at most that minute. Peekaboot starts empty when the saved file is older than
`persistence.max-age` or your `levels` changed. See
[`peekaboot.storage`]({{ '/docs/configuration/' | relative_url }}#peekabootstorage) for where
the file lives.

## Customise the panels {#configuring-panels}

Put a `peekaboot-insights.yml` in `src/main/resources/`, or point
`peekaboot.insights.config-location` at another Spring resource location. Peekaboot's bundled
panels still load underneath. A missing `peekaboot-insights.yml` is not an error. A
`config-location` that names nothing stops startup.

Your file is merged with the bundled panels by panel `id`:

| Entry in your file | Effect |
|---|---|
| Existing id, no `title` | Patches the shipped panel. Only `order`, `enabled` and `level` are taken. Use it to switch a panel on or off, move it, or pin it to a level |
| Existing id, with a `title` | Replaces the shipped panel completely. Series you do not repeat are gone |
| New id | Added and placed by its `order`. The defaults use 10, 20, 30 and so on |
| Unknown id, no `title` | Fails validation, see [below](#invalid-panel-file) |
| Tile | Merges by id, by replacement only |

```yaml
panels:
  # patch: switch a shipped-but-off panel on, by id alone
  - id: thread-states
    enabled: true

  # append: your own, between Heap memory (30) and Non-heap memory (40)
  - id: order-queue
    title: Order queue
    chart: line
    unit: count
    order: 35
    series:
      - id: depth
        label: Depth
        meter: orders.queue.depth
      - id: accepted
        label: Accepted
        meter: orders.accepted
        stat: rate
        unit: persec
```

Find meter names on the [Meters tab]({{ '/docs/dashboard/' | relative_url }}#meters).

### Panel fields {#panel-fields}

| Field | Values | Default |
|---|---|---|
| `id` | the merge key, unique across the merged file | required |
| `title` | the card heading | required, except in a patch |
| `chart` | `line`, `bars`, `bars-line` | `line` |
| `unit` | `bytes`, `percent`, `millis`, `count`, `persec`, `bytes-persec` | `count` |
| `order` | integer; panels without one sort last, then by id | none |
| `enabled` | `false` hides the panel | enabled |
| `level` | the level this panel shows by default; must index a configured level | follows the global switch |
| `series` | the lines to draw | empty |

`percent` expects a meter that reports a ratio from 0 to 1, as Micrometer's CPU and GC meters
do. Peekaboot charts and serves it from 0 to 100.

### Series fields {#series-fields}

| Field | Values | Default |
|---|---|---|
| `meter` | the Micrometer meter name | required |
| `id` | unique within the panel | the meter name |
| `label` | the legend entry | the meter name |
| `tags` | narrows which meters of that name are summed | none, so all are summed |
| `stat` | `value`, `rate`, `avg`, `max` | `value` |
| `unit` | overrides the panel's unit for this line | the panel's |
| `subtract-meter` | subtracts another meter's value; only with `stat: value` | none |

### What each `stat` plots {#what-actually-gets-sampled}

| `stat` | Plots |
|---|---|
| `value` | The meter's current value: a gauge, a counter's total, or a long task timer's active tasks |
| `rate` | The count's increase per second since the previous sample. The first sample after a start is a gap |
| `avg` | The average duration of the calls since the previous sample. No calls gives a gap |
| `max` | Micrometer's MAX for a timer or summary |

`subtract-meter` subtracts a second meter, as Disk space does for Used (`disk.total` minus
`disk.free`). The series' `tags` apply to both.

#### A series with no `tags` sums every meter of that name {#series-without-tags}

`http.server.requests` has one meter per method, URI, status and outcome. A series naming it with
no `tags` adds them all up, so HTTP throughput is the whole application's request rate, without
Peekaboot's own requests. `tags: {outcome: SERVER_ERROR}` narrows the sum to server errors. A series cannot pick out a single endpoint. Use [Traces]({{ '/docs/traces/' | relative_url }})
for per-endpoint questions.

### Stat tiles {#stat-tiles-live-on-overview}

The `tiles` section of the same file defines the
[stat tiles on Overview]({{ '/docs/dashboard/' | relative_url }}#stat-tiles).

### Tile fields {#tile-fields}

| Field | Values | Default |
|---|---|---|
| `id`, `meter` | the tile's key and the meter behind it | required |
| `label` | shown above the value | none |
| `tags` | as for a series | none |
| `format` | `duration`, `datetime`, `bytes`, `count` | raw number |
| `live` | `true` re-reads the value on every refresh; `false` keeps the first value | `false` |

`duration` and `datetime` expect milliseconds, which a time gauge reports, as every default tile
reads. A plain gauge that holds seconds shows a value a thousand times too small.

### An invalid file is ignored {#invalid-panel-file}

Peekaboot validates your file at startup. It is invalid when:

- two panels share an id, or two series of a panel do,
- a series has no `meter`,
- `chart`, `unit`, `stat` or `format` is not one of the values above.

An invalid file is ignored as a whole and the bundled panels show. Your application still
starts. The startup log has an `ERROR`:

```
Insights panel config class path resource [peekaboot-insights.yml] is invalid; discarding it entirely and serving the bundled panels instead of the operator's customisation
```

Check the log first if your panels do not appear. An unknown meter shows a gap and logs a `WARN`
naming it.

## Reading the charts {#reading-the-tab}

- The level switch in the tab header sets the resolution for every panel. Each panel can pin
  its own level.
- Levels above the first draw an average line with a min&ndash;max band. The percentiles
  toggle adds p90, p95 and p99 lines.
- Drag across any chart to zoom all charts to the same time window. The reset control or a
  double-click returns them.
- The Restarts toggle hides the restart markers. It is on by default.
- Focus a chart and press Left or Right to step through its restart markers.
- A gap means no sample. Peekaboot never draws a missed sample as zero. A meter whose function
  throws shows as a gap in its own series and logs one warning.

Each dashboard that is showing the Insights tab holds one streaming connection.
{% include facts/insights-stream-cap.md -%}
See [HTTP API]({{ '/docs/api/' | relative_url }}#the-insights-endpoints).

## What the API judges {#problems}

The [insights data endpoint]({{ '/docs/api/' | relative_url }}#problems) names the problems a
window shows: CPU or GC overhead running high, a heap near its maximum, live threads growing,
connections waiting for the pool, a share of 5xx answers, ERROR lines and slow HTTP latency. The
rules read the default panels' series, so a panel you switch off, or replace without those
series, skips its rule. The tab does not show them.
The thresholds are
[`peekaboot.insights.problems.*`]({{ '/docs/configuration/' | relative_url }}#peekabootinsights),
and slow latency is `peekaboot.tracing.slow-trace-threshold-ms`.
[Agents, read health over time]({{ '/docs/agents/' | relative_url }}#health-over-time) reads the
problems with `curl`.

## Limitations {#percentiles-of-aggregates}

The percentiles on the aggregated levels are percentiles of aggregates, not of individual
requests. Use them to see trends and spot leaks or a saturating pool. Do not use them for SLOs;
that needs a real metrics backend. See
[Traces, limitations]({{ '/docs/traces/' | relative_url }}#tracing-vs-distributed-tracing).

At `1m`, p90, p95 and p99 all equal the maximum.
