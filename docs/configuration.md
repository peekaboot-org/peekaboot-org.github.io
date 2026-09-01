---
title: Configuration
lead: When Peekaboot is on, every peekaboot.* property with its default, and what Peekaboot sets in your application.
permalink: /docs/configuration/
redirect_from:
  - /docs/how-activation-works/
  - /docs/auto-configured-defaults/
---

## When Peekaboot is on

Three properties are detected rather than fixed. Before your own configuration is read,
Peekaboot decides whether this is a local run and sets all three from that:

| Property | On a local run | Elsewhere | Turns on |
|---|---|---|---|
| `peekaboot.enabled` | `true` | `false` | The dashboard, its API, and Peekaboot's defaults |
| `peekaboot.dev-toolbar` | `true` | `false` | The toolbar, log capture and request-detail capture |
| `peekaboot.storage.enabled` | `true` | `false` | Writing the charts and the run history to disk |

The detected values sit below everything you configure, so anything you set &mdash; an
`application.yml` entry, an environment variable, a system property &mdash; wins, in either
direction. The three are detected independently: turning `peekaboot.enabled` on
deliberately in a shared environment gives you the dashboard, not the toolbar and not
files in that host's home directory.

### What counts as a local run {#local-run}

A **local run**, wherever these pages use the term, is a launch Peekaboot's detection reads
as development on your own machine: an IDE run, `mvn spring-boot:run` or `gradle bootRun`
&mdash; more precisely, a launch that runs your build output directly (a classpath entry
such as `target/classes`, `build/classes/…`, `out/production/…` or `bin/main`), outside a
container, and not from a test or an AOT build.

Not a local run, so everything off by default: a `java -jar` of the packaged jar, a war in
a servlet container, a native image, an AOT-processing run, a test (JUnit, Spring Boot's
test support, Cucumber), and anything running in a container &mdash; a Jib image, an
extracted slim jar, a `java -cp` command inside Docker, Podman or Kubernetes included. A bare
`java -cp target/classes:…` on a host that is not a container still counts as local; if
you deploy that way, set `peekaboot.enabled=false` explicitly.

Tests count as not local on purpose, so that CI never picks up the dashboard, the toolbar
and the observability defaults by accident. A test that needs Peekaboot says so:

```java
@SpringBootTest(properties = "peekaboot.enabled=true")
```

<div class="pk-callout pk-callout--warning" markdown="1">
Peekaboot's dashboard and API have no authentication of their own. Before setting
`peekaboot.enabled=true` anywhere reachable by anyone else, read [Do I want this in
production?]({{ '/docs/in-production/' | relative_url }}) and
[Security]({{ '/docs/security/' | relative_url }}).
</div>

### Per-feature switches

Once `peekaboot.enabled` resolves to `true`, each feature has its own switch; nothing below
is reachable while it doesn't.

| Feature | Switch | Also needs |
|---|---|---|
| dashboard and API | `peekaboot.enabled` | A servlet web application and Actuator (present via the starter) |
| dev toolbar | `peekaboot.dev-toolbar` (detected) | A servlet web application, a Micrometer `Tracer` bean and tracing on |
| tracing | `peekaboot.tracing.enabled` (`true`) | The OpenTelemetry SDK (present via the starter) |
| startup and shutdown summaries, run history | `peekaboot.lifecycle.enabled` (`true`) | Nothing |
| persisted history | `peekaboot.storage.enabled` (detected) | A writable directory; an unwritable one is logged once and everything carries on in memory |
| observability defaults | `peekaboot.enabled` | A servlet web application |

On a non-servlet application &mdash; WebFlux, or no web application at all &mdash; the
dashboard and toolbar don't register, there is nothing at `/peekaboot/**`, and the
defaults [below](#what-peekaboot-sets-in-your-application) that hang on `peekaboot.enabled`
are not applied either; the summaries are still logged and, on a local run, the run history
still written. See
[Requirements]({{ '/docs/requirements/' | relative_url }}).

## Properties

### `peekaboot`

| Property | Type | Default | Controls |
|---|---|---|---|
| `enabled` | boolean | detected | The master switch for the dashboard, its API, and Peekaboot's own defaults. |
| `dev-toolbar` | boolean | detected | The dev toolbar, correlated-log capture and full request/response detail capture. |
| `enable-unmasking` | boolean | `false` | Whether an `unmask=true` request may reveal real values from the Environment and Config data. |

`dev-toolbar` captures headers, query and form parameters and the resolved controller,
not request or response bodies. See [Dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}).

`enable-unmasking` changes nothing on its own: it allows the `unmask=true` parameter on
`GET /peekaboot/api/actuator/all/insights` to work and makes the "Show secrets" toggle
appear. It is separate from whether those values are readable at all, which follows the
launch context: off a local run every Environment and Config value is `******`. See
[Security &mdash; masking]({{ '/docs/security/' | relative_url }}#masking) and
[`show-values: always` only on a local
run]({{ '/docs/security/' | relative_url }}#show-values-always-only-on-a-local-run).

### `peekaboot.storage`

The only prefix on this page that touches the filesystem: it decides whether the insights
history and the start/stop log outlive a restart. Everything else Peekaboot holds is in
memory, and is gone when the process is.

| Property | Type | Default | Controls |
|---|---|---|---|
| `enabled` | boolean | detected | Whether anything is written at all. Off, both stores run from memory and never open a file. |
| `dir` | String | `${user.home}/.peekaboot/<groupId>.<artifactId>` | Where the files live. An explicit value is used verbatim, with no per-application subdirectory. |

The default directory sits outside your project on purpose: it survives a `mvn clean` and
a re-clone. `<groupId>.<artifactId>` comes from `build-info.properties`, so it needs a
build that generates one (the Spring Boot Maven plugin's `build-info` goal, or
`springBoot { buildInfo() }` in Gradle). Without it Peekaboot falls back to
`spring.application.name`, and to a fixed `application` folder when there is no name
either &mdash; two applications that share a name, or have none, then share a directory,
which is the case worth setting `dir` for. Characters other than letters, digits, dots,
underscores and dashes become dashes.

Two files land there:

| File | What it holds | Size |
|---|---|---|
| `insights.snapshot` | The insights rings, written at each `peekaboot.insights.persistence.interval` boundary and once more at shutdown | About 5 MB at the default levels |
| `lifecycle.jsonl` | The start and stop history, one JSON object per line, at most 1000 events, oldest dropped first | &le; 400 KB when full |

On a POSIX file system the directory is created `rwx------` and both files `rw-------`,
readable by the owning user alone; a directory that already exists keeps the permissions it
has, and on Windows the platform defaults apply.

Neither file can fail your application. A snapshot this version can't read, that no longer
matches your `peekaboot.insights.levels`, or that is older than
`peekaboot.insights.persistence.max-age` is discarded and the rings start empty; a
`lifecycle.jsonl` line that fails to parse is skipped. An unwritable directory is logged
once and everything carries on in memory. Both stores assume one instance per directory
&mdash; two instances on the same `dir` overwrite each other's history.

### `peekaboot.lifecycle`

| Property | Type | Default | Controls |
|---|---|---|---|
| `enabled` | boolean | `true` | The startup summary, the shutdown summary, and the run history behind the Lifecycle tab and `/peekaboot/api/lifecycle/**`. |

The startup summary carries the application name, build info, server, dashboard and
datasource details; the shutdown summary the uptime and the start and stop timestamps.

#### The URLs in the summary

```
 Service URL: http://localhost:8080
 Swagger UI: http://localhost:8080/swagger-ui.html
 Peekaboot Dashboard: http://localhost:8080/peekaboot/
```

Each line prints only when it leads somewhere. **Service URL** appears whenever there is
an embedded web server, and the lines below it are built from that base: `https` when
`server.ssl.enabled` is set, the port actually bound, and `server.servlet.context-path`
when one is configured; a `0.0.0.0` or unset `server.address` prints as `localhost`.
**Swagger UI** appears when springdoc is on the classpath, honouring
`springdoc.swagger-ui.path`. **Peekaboot Dashboard** appears only when the dashboard is
actually served &mdash; a servlet application, Actuator present, `peekaboot.enabled` true
&mdash; and is omitted otherwise, rather than printed as a URL that would 404.

### `peekaboot.tracing`

| Property | Type | Default | Controls |
|---|---|---|---|
| `enabled` | boolean | `true` | Whether the in-memory trace store exists at all. |
| `max-traces` | int | `1000` | Traces held in the **All** bucket, oldest evicted first; a fixed 30-minute time-to-live also applies. |
| `max-spans-per-trace` | int | `500` | Distinct spans kept per trace after duplicates from double-instrumented layers are folded away; oldest dropped past it, and the trace is flagged `TRUNCATED`. |
| `max-error-traces` | int | `100` | Traces held in the **Errors** bucket. |
| `max-slow-traces` | int | `100` | Traces held in the **Slow** bucket. |
| `slow-trace-threshold-ms` | long | `1000` | Total duration at or above which a trace enters the Slow bucket. |
| `max-logs-per-trace` | int | `500` | Correlated log entries kept per trace; only populated while the dev toolbar is on. |

See [Tracing]({{ '/docs/tracing/' | relative_url }}) for the three buckets and
[Concepts]({{ '/docs/concepts/' | relative_url }}) for what `HIGH_QUERY_COUNT` checks.

### `peekaboot.ui.tracing`

These drive the dashboard's issue detection and badges, not what gets captured &mdash; see
[Concepts]({{ '/docs/concepts/' | relative_url }}#issues).

| Property | Type | Default | Controls |
|---|---|---|---|
| `slow-span-threshold-ms` | long | `100` | A span's own duration at or above this gets the SLOW issue and the SLOW badge on its trace row. |
| `very-slow-span-threshold-ms` | long | `500` | At or above this a span gets VERY_SLOW instead of SLOW; a span never gets both. |
| `slow-query-threshold-ms` | long | `50` | A database query span at or above this gets SLOW_QUERY; the trace detail's Queries tab labels a query SLOW at this same threshold, not the span thresholds above. |
| `high-query-count-threshold` | int | `5` | Direct database-query children one span may have before HIGH_QUERY_COUNT. |
| `high-trace-query-count-threshold` | int | `20` | Database queries a whole trace may run before HIGH_QUERY_COUNT, even if no single span crosses the threshold above. |

### `peekaboot.insights`

These control the metric collector behind the Insights tab &mdash; how often it samples
and how much history it keeps. Whether that history outlives the process is
`peekaboot.storage.enabled` above; *what* it samples comes from a YAML file rather than
from properties, see [Insights]({{ '/docs/insights/' | relative_url }}#configuring-panels).

| Property | Type | Default | Controls |
|---|---|---|---|
| `enabled` | boolean | `true` | Whether the collector, the `/api/insights/**` endpoints and the Insights tab exist; also needs a Micrometer `MeterRegistry` bean. |
| `levels[n].interval` | Duration | `10s`, `1m`, `1h` | The sampling tick (level 0) and each aggregation window above it; every interval must be a whole multiple of the previous one. |
| `levels[n].size` | int | `90`, `1440`, `720` | Entries kept per series at that level; `interval` &times; `size` is how far back the charts reach. |
| `config-location` | String | unset | A Spring resource location for the panel file, replacing `peekaboot-insights.yml` on the classpath root. |
| `persistence.interval` | Duration | the coarsest level's `interval` (`1h`) | How often the rings are written to `insights.snapshot`. Does nothing while storage is off. |
| `persistence.max-age` | Duration | the coarsest level's span (30 days) | How old a snapshot may be and still be loaded; past it every sample would be a gap. |

Setting `levels` replaces the whole list, so give every level you want. Level 0 stores one
number per series per tick; every higher level stores seven (min, max, avg, median, p90,
p95, p99), which is what makes the memory worth checking &mdash; Peekaboot logs the result
at startup. See [Insights &mdash; what it costs]({{ '/docs/insights/' | relative_url }}#what-it-costs).

## What Peekaboot sets in your application

Peekaboot also nudges a handful of Spring Boot and library defaults, so the dashboard has
something to show without you configuring Actuator or sampling by hand. All of them are
added below every property source you control, so anything you set wins; nothing here is a
floor. The two `show-values` rows are set only on a local run and left unset elsewhere,
so Spring's own default governs there.

| Property | Spring default | Peekaboot default | Applies when | Why |
|---|---|---|---|---|
| `management.otlp.metrics.export.enabled` | `true` | `false` | always | The starter puts Micrometer's OTLP registry on the classpath; unconfigured, it would push metrics to `localhost:4318`. Telemetry must not leave the process unless you opt in. |
| `management.tracing.sampling.probability` | `0.1` | `1.0` | `peekaboot.enabled`, servlet web application only | Every request reaches the Traces tab, not a one-in-ten slice. |
| `spring.jpa.properties.[hibernate.generate_statistics]` | `false` | `true` | `peekaboot.enabled`, servlet web application only | The `hibernate.*` meter panels on Insights need Hibernate's statistics. |
| `management.info.env.enabled` | `false` | `true` | `peekaboot.enabled`, servlet web application only | Your `info.*` properties reach the Overview tab (not OS environment variables; the Environment tab covers those). |
| `management.info.java.enabled` | `false` | `true` | `peekaboot.enabled`, servlet web application only | The Java card on Overview. |
| `management.info.os.enabled` | `false` | `true` | `peekaboot.enabled`, servlet web application only | The System card on Overview. |
| `management.info.process.enabled` | `false` | `true` | `peekaboot.enabled`, servlet web application only | PID, uptime, CPU count and memory on Overview. |
| `management.observations.annotations.enabled` | `false` | `true` | `peekaboot.enabled`, servlet web application only | `@Observed`, `@Timed` and `@Counted` work without extra wiring. |
| `management.endpoint.env.show-values` | `never` | `always` | local run only | Otherwise the Environment tab shows `******` for every property, `server.port` included; Peekaboot's own masking runs over the real values instead. |
| `management.endpoint.configprops.show-values` | `never` | `always` | local run only | The same, for the Config tab. |
| `management.opentelemetry.tracing.export.schedule-delay` | `5s` | `200ms` | dev toolbar on | Spring Boot's span export delay is what separates a span ending from the toolbar seeing it; shortened so a trace is readable while you are still on the page. |

Traces and logs need no export switch: Spring Boot only creates OTLP exporters for them
when you configure an endpoint. Nothing on `/actuator/**` changes &mdash; Peekaboot reads
Actuator in-process and adds no exposure of its own.

<div class="pk-callout pk-callout--warning" markdown="1">
**Some of these widen what is exposed, or cost something at runtime:**

- `show-values: always`, on a local run, also widens your own `/actuator/env` and
  `/actuator/configprops` if you expose them over HTTP yourself &mdash; Peekaboot's masking
  runs only inside `/peekaboot/**`. See [Security]({{ '/docs/security/' | relative_url }}#show-values-always-only-on-a-local-run).
- `management.info.env.enabled: true` publishes `info.*` through `/actuator/info` if you
  expose that endpoint.
- Sampling at `1.0` means every request is traced, for every exporter you have configured.
- Hibernate statistics carry a runtime cost.
- With the toolbar on, spans reach every exporter roughly 25 times more often than at
  Spring's default.

None of this matters on your own machine. It matters the moment `peekaboot.enabled` is
`true` somewhere reachable by anyone else &mdash; see [Do I want this in
production?]({{ '/docs/in-production/' | relative_url }}).
</div>

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
more than 50 spans, this configuration will truncate them &mdash; watch for the
`TRUNCATED` badge before combining it with a query-heavy workload.

### Query-heavy application

An endpoint that legitimately issues dozens, or a few hundred, queries by design (a
report, a bulk export, an N+1-shaped-but-intentional fan-out) needs headroom on two axes:
enough span capacity that its queries survive truncation, and thresholds that don't flag
its normal behaviour as an issue on every single request. The default cap (500, after
duplicates are folded away) already covers most such endpoints; if the trace list shows a
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
`TRUNCATED` badge before assuming it is. Only then raise the UI thresholds, and only as far
as reflects what's actually normal for this endpoint; set them too high and a genuine
regression (a query count that grows well past what's normal) stops triggering
HIGH_QUERY_COUNT at all.
