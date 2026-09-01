---
title: Insights
lead: Live charts over Micrometer's meters, sampled and aggregated inside your own process &mdash; no Prometheus, no time-series database, nothing to scrape.
permalink: /docs/insights/
---

The Insights tab charts a curated set of the meters your application already publishes.
Sampling, aggregation and storage all happen in your own JVM, in fixed-size ring buffers
&mdash; there's no scrape endpoint to expose, no exporter to configure, and no backend to
stand up first. It's on whenever Peekaboot is (`peekaboot.insights.enabled: true`) and
there's a Micrometer `MeterRegistry` bean to read.

<div class="pk-callout" markdown="1">
The rings live in memory, but on a [local run]({{ '/docs/configuration/' | relative_url }}#local-run)
they outlive the process: Peekaboot writes
them to a snapshot file and reads them back at the next start, so the charts resume
instead of filling from empty. That is
[`peekaboot.storage.enabled`]({{ '/docs/configuration/' | relative_url }}#peekabootstorage)
&mdash; on by default for a local launch, off everywhere else, and with it off a restart
does start the history over. See [Surviving a restart](#surviving-a-restart).
</div>

## What actually gets sampled

Each panel in the config resolves to a flat list of **series**: a meter name, an optional
tag filter, and a statistic derived from it. Peekaboot reads those meters straight off the
`MeterRegistry` once per tick.

| `stat` | What it reads |
|---|---|
| `value` | The meter's current value at tick time &mdash; gauges, counter totals, a long task timer's active-task count |
| `rate` | The count's delta since the previous tick, normalized to per-second |
| `avg` | &Delta;total-time &divide; &Delta;count over the tick &mdash; the average duration of the calls that happened *in that window*, not since startup |
| `max` | The timer's or summary's MAX sample |

Meters are re-resolved on **every** tick rather than looked up once at startup, because
Micrometer registers them lazily &mdash; `http.server.requests` doesn't exist until your
app has served its first request, and new tag combinations (a new URI) appear later still.
A panel whose meters never show up at all costs nothing and simply renders as "No data".

### A series with no `tags` sums every meter matching its name

This is the single behaviour most likely to surprise you. `http.server.requests` is not
one meter &mdash; it's one per method/URI/status/outcome combination. A series naming it
with no tag filter adds all of them together, so the HTTP throughput panel is a
whole-application request rate, not a per-endpoint one. Adding `tags: {outcome:
SERVER_ERROR}` narrows the sum to the matching subset; it never picks a single meter.

That collapsing is deliberate: cardinality that would sink an in-process ring buffer is
exactly what a real metrics backend is for, and per-endpoint questions are better answered
on the [Traces]({{ '/docs/tracing/' | relative_url }}) tab, which keeps each request
separate anyway.

## Levels

Samples are kept at several resolutions at once. The defaults are three:

| Level | Interval | Entries | Covers |
|---|---|---|---|
| 0 | `10s` | 90 | 15 minutes |
| 1 | `1m` | 1440 | 24 hours |
| 2 | `1h` | 720 | 30 days |

Level 0 stores the raw tick value, one number per series per tick. Every higher level
stores **seven** numbers per entry &mdash; min, max, avg, median, p90, p95, p99 &mdash;
computed over the window that just closed. Windows are aligned to the wall clock, so
timestamps come out round. A tick that doesn't happen is stored as a gap, never as a zero.

The list is fully replaceable through `peekaboot.insights.levels` (see
[Configuration]({{ '/docs/configuration/' | relative_url }}#peekabootinsights)). Level 0 is
the sampling tick; each further interval must be a whole multiple of the one before it, or
startup fails with a message naming the level.

### Percentiles are percentiles of aggregates

Micrometer retains no raw samples, so neither does Peekaboot &mdash; and that limits what
the aggregated levels can honestly claim:

- A **1h** entry's p99 is the p99 of the sixty one-minute *averages* inside that hour. It
  is not the 99th-percentile request latency; a single very slow request inside an
  otherwise quiet minute is averaged away before the percentile is ever computed.
- A **1m** entry aggregates only six ticks, so its percentiles largely collapse onto its
  max. p90, p95 and p99 will often sit on the same value.
- The `max` stat reads Micrometer's timer MAX, which is a **decaying-window** max. The
  tick value approximates "the max in this tick" rather than measuring it exactly.

These are fit for a development tool &mdash; enough to see a shape change, spot a leak, or
catch a pool saturating. They are not the numbers to put in an SLO. If you need true
percentiles you need retained samples, which means a real metrics backend; see [Tracing
&mdash; tracing vs distributed tracing]({{ '/docs/tracing/' | relative_url }}#tracing-vs-distributed-tracing).

### What it costs

The footprint is:

```
series x (level-0 size + sum of higher-level sizes x 7) x 8 bytes
```

At the defaults &mdash; 39 series, `10s`&times;90, `1m`&times;1440, `1h`&times;720 &mdash;
that's 39 &times; (90 + 1440&times;7 + 720&times;7) &times; 8 &asymp; 4.5 MB. Peekaboot
computes it from your effective config and logs it once at startup, so you never have to
work it out yourself:

```
Peekaboot insights: 39 series across 16 panels, levels [10s x90, 1m x1440, 1h x720], ring buffers ~4.5 MB
```

Raising a level's `size`, adding levels, or enabling more panels all move this number, and
the log line tells you where it landed.

## The default panels

Sixteen panels ship enabled, in this display order. Panels whose meters aren't present
&mdash; no Hikari pool, no Hibernate, no `datasource-micrometer` &mdash; stay in the config
and render as "No data" rather than disappearing.

| Panel | Series | Meters |
|---|---|---|
| CPU usage | Process, System, GC overhead | `process.cpu.usage`, `system.cpu.usage`, `jvm.gc.overhead` |
| System load | Load 1m, CPU cores | `system.load.average.1m`, `system.cpu.count` |
| Heap memory | Used, Committed, Max | `jvm.memory.*{area=heap}` |
| Non-heap memory | Used, Committed | `jvm.memory.*{area=nonheap}` |
| Garbage collection | Pauses (rate), Max pause (ms) | `jvm.gc.pause` |
| Threads | Live, Daemon, Peak | `jvm.threads.*` |
| HTTP throughput | Requests, 4xx, 5xx | `http.server.requests` |
| HTTP latency | Avg, Max | `http.server.requests` |
| HTTP in flight | Active requests | `http.server.requests.active` |
| DB pool | Total, Active, Idle, Pending, Max | `hikaricp.connections*` |
| DB pool timing | Acquire avg, Usage avg | `hikaricp.connections.acquire`, `.usage` |
| JDBC queries | Queries, Avg time | `jdbc.query` |
| Repositories | Invocations, Avg time | `spring.data.repository.invocations` |
| Transactions | Success, Failure | `hibernate.transactions` |
| Disk space | Free, Used, Total | `disk.free`, `disk.total` |
| Log events | Errors, Warnings | `logback.events` |

Six more ship in the bundled file with `enabled: false`, ready to switch on by id (see
below): **Thread states**, **Hibernate activity**, **Executors**, **Open files**, **Tomcat
sessions** and **Memory allocation**. Nothing outside the panel file is collected at all
&mdash; if a meter isn't named by a series, no ring buffer exists for it.

### Stat tiles live on Overview

The five tiles &mdash; Started at, Startup, Ready after, Uptime, CPU cores &mdash; are
defined in the same file, but they're rendered by the **Overview** tab, not this one. They
carry no ring buffer &mdash; only a current value: `uptime` is `live: true` and re-samples
on every tick, while the rest are sampled until they first resolve and then frozen.

Overview reads those values off `/api/insights/config`, which carries them alongside the
tile definitions, so the row rides the dashboard's ordinary 30-second refresh instead of
needing the Insights tab's SSE stream. A `live` tile is therefore as current as that
refresh, not as current as the tick.

## Configuring panels

The bundled defaults live inside the starter jar as `peekaboot-insights-defaults.yml`. To
change them, put your own `peekaboot-insights.yml` on the classpath root
(`src/main/resources/`), or point `peekaboot.insights.config-location` somewhere else. The
two are merged **by id**:

- **Same id** &mdash; your panel replaces the default one *wholly*. It isn't a field-by-field
  merge: repeat the series you want to keep.
- **New id** &mdash; appended, then positioned by its `order`. The defaults use 10, 20, 30…
  so there's room to interleave.
- **`enabled: false`** &mdash; hides a default panel without redefining it.

```yaml
panels:
  # switch a shipped-but-off panel on, by id alone
  - id: thread-states
    enabled: true

  # hide one you don't care about
  - id: load
    enabled: false

  # add your own, between Heap memory (30) and Non-heap memory (40)
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
| `id` | required &mdash; the merge key | &mdash; |
| `title` | required &mdash; the card heading | &mdash; |
| `chart` | `line`, `bars`, `bars-line` | `line` |
| `unit` | `bytes`, `percent`, `millis`, `count`, `persec`, `bytes-persec` | `count` |
| `order` | integer; unordered panels sort last, then by id | none |
| `enabled` | `false` hides the panel | enabled |
| `level` | pins this panel to one aggregation level by default | follows the global switch |
| `series` | the lines to draw | empty |

### Series fields

| Field | Values | Default |
|---|---|---|
| `meter` | required &mdash; the Micrometer meter name | &mdash; |
| `id` | unique within the panel | the meter name |
| `label` | the legend entry | the meter name |
| `tags` | map narrowing which meters of that name are summed | none &mdash; sums all of them |
| `stat` | `value`, `rate`, `avg`, `max` | `value` |
| `unit` | overrides the panel's unit for this one line | the panel's |
| `subtract-meter` | subtracts another meter's summed value; only meaningful with `stat: value` | none |

`subtract-meter` is how the Disk space panel draws "used" without a meter for it: `disk.total`
minus `disk.free`. If either side is unresolved the result is a gap, not a wrong number.

### Tile fields

| Field | Values | Default |
|---|---|---|
| `id`, `meter` | required | &mdash; |
| `label` | shown above the value | none |
| `tags` | as for a series | none |
| `format` | `duration`, `datetime`, `bytes`, `count` | raw number |
| `live` | `true` re-samples every tick; `false` freezes at the first resolved value | `false` |

### A mistake in your file costs you panels, not your app

The loader validates every id, title and meter name, and every `chart`, `unit`, `stat` and
`format` against the sets above. The bundled defaults are loaded and validated **on their
own first**: they're Peekaboot's, so a fault there is Peekaboot's bug and startup fails
loudly. Your override is merged on top separately, and if it doesn't validate it's dropped
entirely &mdash; logged at `ERROR`, with the bundled defaults used instead:

```
Ignoring invalid insights panel config class path resource [peekaboot-insights.yml]; using the bundled defaults
```

So a typo in your panel file costs you your customisation, never the application Peekaboot
is embedded in. Check the startup log if your panels don't appear.

## Live updates arrive by push

Live updates are pushed (SSE): the tab holds one stream open against
`GET /peekaboot/api/insights/stream` and never polls, receiving a `tick` per level-0
interval and a `rollup` whenever a higher level's window closes. See [HTTP
API]({{ '/docs/api/' | relative_url }}#the-insights-endpoints) for the events themselves.

## Surviving a restart

With `peekaboot.storage.enabled` on &mdash; the default for a local run &mdash; the rings
are written to `insights.snapshot` at each `peekaboot.insights.persistence.interval`
boundary (by default one write per coarsest window) and once more at shutdown, after the
collector has stopped so the last write sees settled rings. The next start reads them back
and the charts carry on.

The restart itself stays visible rather than being smoothed over. The gap while the
application was down is padded as a gap, not interpolated across, so a chart shows the
outage as the hole it was; and every start and stop is drawn as a **restart marker** over
the charts, from the same history the [Lifecycle tab]({{ '/docs/dashboard/' | relative_url }}#lifecycle)
tabulates. The **Restarts** toggle in the tab header turns those markers off.

Loading never delays your application's startup.

The snapshot is a cache, never a source of truth. One that this version can't read, that
no longer matches your `levels` geometry, or that is older than
`peekaboot.insights.persistence.max-age` (by default the span the coarsest level covers) is
discarded, and the rings start empty exactly as they would with storage off. Nothing about
a bad snapshot can fail your application. See
[Configuration &mdash; `peekaboot.storage`]({{ '/docs/configuration/' | relative_url }}#peekabootstorage)
for where the file lives and what else lands beside it.

## Reading the tab

- The **level switch** in the tab header sets the resolution every panel charts at. Each
  panel carries the same switch, sized down, to pin itself to a different one; a reset
  control puts it back under the global switch.
- The **percentiles** toggle adds p90/p95/p99 lines on the aggregated levels, which
  otherwise draw an average line with a translucent min&ndash;max band.
- **Drag-selecting** across any chart zooms every chart to that same x-window, so panels
  stay comparable; a reset control clears it and returns them all to auto-fitting.
- The **Restarts** toggle draws a marker over every chart at each recorded start and
  stop &mdash; see [Surviving a restart](#surviving-a-restart). It is on by default, and
  a history that can't be fetched simply means no markers rather than a failed tab.
- A panel reading **"No data"** has resolved none of its series &mdash; usually the
  subsystem it charts isn't on the classpath at all. It stays visible on purpose, so a
  missing pool or missing Hibernate is something you can see rather than something you have
  to notice the absence of.

## When the tab isn't there

The Insights tab needs all of:

- a **servlet** web application (as does the rest of the dashboard),
- `peekaboot.enabled` &mdash; see [Configuration]({{ '/docs/configuration/' | relative_url }}#when-peekaboot-is-on),
- `peekaboot.insights.enabled`, `true` by default,
- a Micrometer **`MeterRegistry`** bean &mdash; Spring Boot Actuator, which the starter pulls
  in, provides one.

Without the registry there's nothing to sample, so the collector, the API and the tab are
all absent rather than empty. `GET /peekaboot/api/features` reports this as `insights`; see
[The dashboard]({{ '/docs/dashboard/' | relative_url }}#conditionally-shown-tabs).
