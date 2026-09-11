---
title: Insights
lead: Live charts over Micrometer's meters, sampled and aggregated inside your own process.
permalink: /docs/insights/
---

The Insights tab charts a curated set of the meters your application already publishes.
Sampling, aggregation and storage happen in your own JVM, in fixed-size ring buffers. No scrape
endpoint, no exporter, no backend to stand up first.

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-insights-light.png' | relative_url }}"
       alt="The Insights tab, live line charts of CPU usage and system load with an aggregation level switch and toggles for percentiles and restart markers"
       loading="lazy">
</figure>

<div class="pk-callout" markdown="1">
The rings live in memory, but on a [local run]({{ '/docs/configuration/' | relative_url }}#local-run)
they outlive the process. Peekaboot snapshots them and reads them back at the next start, so the
charts resume instead of filling from empty. That is
[`peekaboot.storage.enabled`]({{ '/docs/configuration/' | relative_url }}#peekabootstorage), on
by default for a local launch and off everywhere else. See
[Surviving a restart](#surviving-a-restart).
</div>

## What actually gets sampled

Each panel resolves to a flat list of **series**, each a meter name, an optional tag filter and
a statistic. Peekaboot reads them off the `MeterRegistry` once per tick.

| `stat` | What it reads |
|---|---|
| `value` | The meter's current value at tick time: gauges, counter totals, a long task timer's active-task count. A timer or a distribution summary yields a gap, not a number. |
| `rate` | The count's delta since the previous tick, normalized to per-second. The first tick has no baseline yet, so it is a gap. |
| `avg` | &Delta;total-time &divide; &Delta;count over the tick, the average duration of the calls that happened *in that window*, not since startup. A tick with no calls is a gap. |
| `max` | The timer's or summary's MAX, which is a decaying window rather than this one tick. See [Percentiles are percentiles of aggregates](#percentiles-are-percentiles-of-aggregates). |

Meters are re-resolved on **every** tick, not looked up once at startup, because Micrometer
registers them lazily. `http.server.requests` does not exist before the first request, and new
tag combinations (a new URI) appear later still. A panel whose meters never resolve still costs
a lookup per tick and its share of the ring budget.

### A series with no `tags` sums every meter matching its name

`http.server.requests` is not one meter. It is one meter per method/URI/status/outcome
combination, and a series naming it with no tag filter adds all of them together, so the HTTP
throughput panel is a whole-application request rate. Adding `tags: {outcome: SERVER_ERROR}`
narrows the sum to the matching subset. It never picks a single meter.

The collapsing is deliberate. Cardinality that would sink an in-process ring buffer is what a
real metrics backend is for, and per-endpoint questions belong on the
[Traces]({{ '/docs/traces/' | relative_url }}) tab.

## Levels

Samples are kept at several resolutions at once, three by default:

| Level | Interval | Entries | Covers |
|---|---|---|---|
| 0 | `10s` | 90 | 15 minutes |
| 1 | `1m` | 1440 | 24 hours |
| 2 | `1h` | 720 | 30 days |

Level 0 stores the raw tick value, one number per series per tick. Every higher level stores
seven statistics over the window that just closed: min, max, avg, median, p90, p95 and p99. Each
entry carries an eighth the API never shows, the count of samples behind it, which the next
roll-up weights its average by. Windows align to the wall clock, so timestamps come out round. A
missed tick is a gap, never a zero.

`peekaboot.insights.levels` replaces the whole list (see
[Configuration]({{ '/docs/configuration/' | relative_url }}#peekabootinsights)). Level 0 is the
sampling tick. Each further interval must be a whole multiple of the one before it, and its
window must fit inside the previous level's ring. Either failure fails startup, naming the two
intervals rather than a level index.

### Percentiles are percentiles of aggregates

Micrometer retains no raw samples, so neither does Peekaboot. That limits what the aggregated
levels can honestly claim:

- A **1m** entry aggregates six ticks. Percentiles are nearest-rank, so over six samples p90,
  p95 and p99 all equal the window's maximum. Only min, avg and median add anything the max
  does not.
- A **1h** entry's p99 is the p99 of the sixty one-minute *averages* in that hour, again always
  their maximum. Only p90 and p95 carry real percentile information. A very slow request inside
  an otherwise quiet minute is averaged away before any percentile is computed.
- An hour's **min** and **max** are the true min and max of the minutes below, so a spike
  survives into `max` where the percentiles average it out.
- The `max` stat reads Micrometer's timer MAX, a decaying window. Under Spring Boot's defaults
  (a two-minute expiry over three buffers) it covers roughly the last four to six minutes, not
  the tick it is plotted at.

Enough to see a shape change, spot a leak or catch a pool saturating. Not the numbers to put in
an SLO. True percentiles need retained samples, which means a real metrics backend. See
[Traces: tracing vs distributed tracing]({{ '/docs/traces/' | relative_url }}#tracing-vs-distributed-tracing).

### What it costs

The footprint is:

```
series x (level-0 size + sum of higher-level sizes x 8) x 8 bytes
```

Eight per higher-level entry, not seven, because the sample count rides with the statistics. At
the default levels that is (90 + 1440&times;8 + 720&times;8) &times; 8 bytes for each series,
and the total follows how many series the enabled panels resolve to. Peekaboot computes that
from your effective config and logs the real figure at startup, in this shape:

```
Peekaboot insights: <series> series across <panels> panels, levels [10s x90, 1m x1440, 1h x720], ring buffers ~<size>, persisted across restarts
```

Sizes there are 1024-based. The trailing `, persisted across restarts` appears only while
storage is on. Raising a level's `size`, adding levels or switching more panels on all move the
number, and the log line says where it landed.

## The default panels

These panels ship enabled, in display order. A panel whose meters are absent (no Hikari
pool, no Hibernate, no `datasource-micrometer`) resolves no series, stays in the config and
renders as "No data" rather than disappearing.

| Panel | id | Series | Meters |
|---|---|---|---|
| CPU usage | `cpu` | Process, System, GC overhead | `process.cpu.usage`, `system.cpu.usage`, `jvm.gc.overhead` |
| System load | `load` | Load 1m, CPU cores | `system.load.average.1m`, `system.cpu.count` |
| Heap memory | `heap` | Used, Committed, Max | `jvm.memory.*{area=heap}` |
| Non-heap memory | `nonheap` | Used, Committed | `jvm.memory.*{area=nonheap}` |
| Garbage collection | `gc` | Pauses, Max pause | `jvm.gc.pause` |
| Threads | `threads` | Live, Daemon, Peak | `jvm.threads.*` |
| HTTP throughput | `http-throughput` | Requests, 4xx, 5xx | `http.server.requests` |
| HTTP latency | `http-latency` | Avg, Max | `http.server.requests` |
| HTTP in flight | `http-active` | Active requests | `http.server.requests.active` |
| DB pool | `db-pool` | Total, Active, Idle, Pending, Max | `hikaricp.connections*` |
| DB pool timing | `db-pool-timing` | Acquire avg, Usage avg | `hikaricp.connections.acquire`, `.usage` |
| JDBC queries | `jdbc-queries` | Queries, Avg time | `jdbc.query` |
| Repositories | `repositories` | Invocations, Avg time | `spring.data.repository.invocations` |
| Transactions | `transactions` | Success, Failure | `hibernate.transactions` |
| Disk space | `disk` | Free, Used, Total | `disk.free`, `disk.total` |
| Log events | `log-events` | Errors, Warnings | `logback.events` |

Garbage collection is the only panel drawn as bars plus a line; the rest are plain line
charts. Its Pauses series is a `rate`, and its Max pause series overrides the panel's unit to
milliseconds, as do the average-time series on JDBC queries and Repositories.

Others ship with `enabled: false`, ready to switch on by id: `thread-states` (Thread states),
`hibernate-activity` (Hibernate activity), `executors` (Executors), `open-files` (Open files),
`tomcat-sessions` (Tomcat sessions) and `allocation` (Memory allocation). Nothing outside the
panel file is collected; a meter no series names has no ring buffer.

### Stat tiles live on Overview

The four tiles, Started at, Startup, Ready after and Uptime, are defined in the same file but
rendered by the Overview tab. (The CPU core count is not a tile; it sits on Overview's Machine
card.) They carry no ring buffer, only a current value, sampled when the dashboard reads them,
so a freshly started app shows values at the first look. `uptime` is `live: true` and re-samples
on every read; the rest are sampled until they first resolve, then frozen.

Overview reads them off `/api/insights/config` alongside the tile definitions, so the row rides
the dashboard's 30-second refresh rather than the Insights SSE stream. A `live` tile is exactly
as current as that refresh.

## Configuring panels

The bundled defaults live inside the starter jar as `peekaboot-insights-defaults.yml`. To change
them, put your own `peekaboot-insights.yml` on the classpath root (`src/main/resources/`), or
point `peekaboot.insights.config-location` at another Spring resource location. That property
replaces your override file's lookup only; the bundled defaults still load underneath. A missing
override file is not an error.

The two files are merged by panel id, in three modes:

- **Patch.** An entry with no `title`, under an id that exists in the defaults, takes only
  `order`, `enabled` and `level` from your file; title, chart, unit and series stay as shipped.
  Use it to switch a shipped panel on, hide one, or pin one to a level.
- **Whole replacement.** An entry *with* a `title`, under an id that exists in the defaults,
  replaces the shipped panel outright. There is no field-by-field merge, and series you do not
  repeat are gone.
- **Append.** An entry under a new id is added and positioned by its `order`. The defaults use
  10, 20, 30 and so on, so there is room to interleave.

An entry with no `title` under an id that does not exist has nothing to patch, and fails
validation. Tiles merge by id as well, replacement only, with no patch mode.

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

### Panel fields

| Field | Values | Default |
|---|---|---|
| `id` | the merge key, unique across the merged file | required |
| `title` | the card heading | required, except in a patch |
| `chart` | `line`, `bars`, `bars-line` | `line` |
| `unit` | `bytes`, `percent`, `millis`, `count`, `persec`, `bytes-persec` | `count` |
| `order` | integer; unordered panels sort last, then by id | none |
| `enabled` | `false` hides the panel | enabled |
| `level` | pins this panel to one aggregation level by default; must index a configured level | follows the global switch |
| `series` | the lines to draw | empty |

### Series fields

| Field | Values | Default |
|---|---|---|
| `meter` | the Micrometer meter name | required |
| `id` | unique within the panel | the meter name |
| `label` | the legend entry | the meter name |
| `tags` | map narrowing which meters of that name are summed | none, so all of them are summed |
| `stat` | `value`, `rate`, `avg`, `max` | `value` |
| `unit` | overrides the panel's unit for this one line | the panel's |
| `subtract-meter` | subtracts another meter's summed value; only valid with `stat: value` | none |

`subtract-meter` is how the Disk space panel draws "used" without a meter for it, `disk.total`
minus `disk.free`. Both sides go through the same tag filter, so a series' `tags` narrow the
subtracted meter too. If either side is unresolved the result is a gap, not a wrong number.
Naming `subtract-meter` on a series with `stat: rate`, `avg` or `max` fails config validation;
see [A mistake in your file costs you panels, not your
app](#a-mistake-in-your-file-costs-you-panels-not-your-app).

### Tile fields

| Field | Values | Default |
|---|---|---|
| `id`, `meter` | the tile's key and the meter behind it | required |
| `label` | shown above the value | none |
| `tags` | as for a series | none |
| `format` | `duration`, `datetime`, `bytes`, `count` | raw number |
| `live` | `true` re-samples on every read; `false` freezes at the first resolved value | `false` |

Tiles take no `stat` and no `subtract-meter`; they always read the meter's current value. The
four shipped tiles sit on Micrometer `TimeGauge`s, read in seconds, which is what `duration` and
`datetime` formatting assumes. A tile of your own over a plain gauge holding milliseconds
renders a thousand times too large.

### A mistake in your file costs you panels, not your app

The loader checks that every panel has a unique id, and that every series names a meter and has
an id unique within its panel. Each `chart`, `unit`, `stat` and `format` must be one of the
values above, and a series with `subtract-meter` must use `stat: value` or leave `stat` unset.
The registry is never checked, so an unknown meter is a permanent gap and never a startup
failure.

The bundled defaults are validated **on their own first**. A fault there is Peekaboot's bug and
startup fails loudly. Your override is merged on top separately. If it does not validate,
Peekaboot discards the whole file, every panel in it, and serves the bundled defaults instead.
The failure is logged at `ERROR` with the stack trace:

```
Insights panel config class path resource [peekaboot-insights.yml] is invalid; discarding it entirely and serving the bundled panels instead of the operator's customisation
```

The resource name is whatever Spring resolved, so a `config-location` pointing at a file reads
`file [/etc/app/panels.yml]`. Check the startup log if your panels do not appear.

## Live updates arrive by push

The tab holds one SSE stream open against `GET /peekaboot/api/insights/stream` instead of
polling, taking a `tick` per level-0 interval and a `rollup` as each higher window closes. The
server closes a stream after 30 minutes and the browser reopens it. Nothing is replayed on
reconnect, so the tab re-fetches each loaded level once. At most 32 streams are open per
application, so a 33rd dashboard gets a `503` until one closes. See
[HTTP API]({{ '/docs/api/' | relative_url }}#the-insights-endpoints) for the events.

## Surviving a restart

With `peekaboot.storage.enabled` on, the default for a local run, the rings are written to
`insights.snapshot` at each `peekaboot.insights.persistence.interval` boundary, one write per
coarsest window by default. A final write happens at shutdown, after the collector has stopped,
so it sees settled rings. The next start reads them back and the charts carry on. A scheduled write
is skipped while a snapshot this run never took over is still on disk, so a restore that timed
out cannot overwrite a full retention window with a few samples.

The downtime is padded as a gap, never interpolated across, so a chart shows the outage as the
hole it was. Every start and stop is drawn as a **restart
marker** over the charts, from the same history the
[Lifecycle tab]({{ '/docs/dashboard/' | relative_url }}#lifecycle) tabulates. Loading never
delays your application's startup.

The snapshot is a cache, never a source of truth. Peekaboot discards it when this version cannot
read it, when it no longer matches your `levels` geometry, when it is older than
`peekaboot.insights.persistence.max-age` (the coarsest level's span by default), or when it is
dated more than five minutes in the future. The rings then start empty, as with storage off.
Each case is logged at `INFO` and the file deleted, so a bad snapshot cannot fail your
application now or later. See
[`peekaboot.storage`]({{ '/docs/configuration/' | relative_url }}#peekabootstorage) for where the
file lives and what else lands beside it.

## Reading the tab

- The **level switch** in the tab header sets the resolution every panel charts at. Each panel
  carries the same switch, sized down, to pin itself to another; a reset control returns it to
  the global one.
- The **percentiles** toggle adds p90/p95/p99 lines on the aggregated levels, which otherwise
  draw an average line with a translucent min&ndash;max band.
- **Drag-selecting** across any chart zooms every chart to the same x-window, so panels stay
  comparable; a reset control returns them to auto-fitting.
- The **Restarts** toggle in the tab header switches the markers off. It is on by default, and a
  history that cannot be fetched means no markers rather than a failed tab.

## When the tab isn't there {#when-the-tab-isnt-there}

The Insights tab needs all of:

- a **servlet** web application, as does the rest of the dashboard,
- `peekaboot.enabled`, see [Configuration]({{ '/docs/configuration/' | relative_url }}#when-peekaboot-is-on),
- `peekaboot.insights.enabled`, `true` by default,
- a Micrometer **`MeterRegistry`** bean, which Spring Boot Actuator provides and the starter
  pulls in.

Without the registry there is nothing to sample, so the collector, the API and the tab are all
absent rather than empty. `GET /peekaboot/api/features` reports this as `insights`; see
[The dashboard]({{ '/docs/dashboard/' | relative_url }}#conditionally-shown-tabs).
