---
title: Configuration
lead: When Peekaboot is on, every peekaboot.* property with its default, and what Peekaboot sets in your application.
permalink: /docs/configuration/
redirect_from:
  - /docs/how-activation-works/
  - /docs/auto-configured-defaults/
---

## When Peekaboot is on

Three properties are detected rather than fixed, set from whether Peekaboot read this launch as
a local run.

| Property | On a local run | Elsewhere | Turns on |
|---|---|---|---|
| `peekaboot.enabled` | `true` | `false` | The dashboard, its API, and Peekaboot's defaults. |
| `peekaboot.dev-toolbar` | `true` | `false` | The toolbar, log capture and request-detail capture. |
| `peekaboot.storage.enabled` | `true` | `false` | Writing the charts and the run history to disk. |

They sit below every property source you control, so an `application.yml` entry, an environment
variable or a system property wins in either direction. The three are detected
independently: turning `peekaboot.enabled` on deliberately in a shared environment gives you
the dashboard, not the toolbar and not files in that host's home directory.

### What counts as a local run {#local-run}

A **local run** is a launch Peekaboot reads as development on your own machine: an IDE run,
`mvn spring-boot:run`, `gradle bootRun`. Every one of these has to hold.

- The launching thread is named exactly `main`.
- Its context class loader is the JVM's own application class loader, meaning a class whose
  name contains `AppClassLoader`.
- The stack that started the application carries no test or AOT frame: `org.junit.runners.`,
  `org.junit.platform.`, `org.springframework.boot.test.`,
  `org.springframework.boot.SpringApplicationAotProcessor`, `cucumber.runtime.`.
- The class path contains a build-output directory: an entry ending `/target/classes`,
  `/build/classes/java/main`, `/build/classes/kotlin/main`, `/build/classes/groovy/main`,
  `/build/classes/scala/main` or `/bin/main`, or containing `/out/production/`.
- No container marker is present.
- The process is not a running native image.

The first two conditions reject a packaged artifact. `java -jar` runs under Spring Boot's own
launcher class loader, a war under the servlet container's webapp loader, and neither name
contains `AppClassLoader`.

The class-path condition reads `java.class.path` and, for each entry ending `.jar`, the
`Class-Path` entries in that jar's manifest, resolved against the jar's own directory. Both
face the same build-output test. IntelliJ shortens a long command line by moving the real class
path into a temp jar's manifest, and Peekaboot would otherwise stay off with no message.

This rejects a Jib image (class path `/app/resources:/app/classes:/app/libs/*`) and Spring
Boot's `extract` layout, whose thin jar lists only jars in its manifest. Both fail on the class
path whether or not a container is involved.

Under Spring Boot DevTools the restart runs on DevTools' own class loader. Peekaboot skips the
thread, class-loader and stack checks there and applies the class-path and container checks
alone.

Not a local run, so everything off by default: `java -jar`, a war, a native image, an AOT run,
a test, anything with a container marker. A bare `java -cp target/classes:…` on a host with no
marker still counts as local; if you deploy that way, set `peekaboot.enabled=false` yourself.

#### Container markers

There are exactly four, checked in this order:

- the `KUBERNETES_SERVICE_HOST` environment variable is set, whatever its value.
- `/.dockerenv` exists.
- `/run/.containerenv` exists.
- `/proc/1/cgroup` is readable and contains `docker`, `kubepods` or `containerd`.

A missing or unreadable `/proc/1/cgroup` counts as no container.

There is no devcontainer marker and none is needed, since a devcontainer runs your application
in a container and a container is never a local run. A checkout you work on inside VS Code Dev
Containers or Codespaces therefore starts with everything off, which is easy to mistake for a
broken starter. Set all three in the devcontainer's own configuration:

```yaml
peekaboot:
  enabled: true
  dev-toolbar: true
  storage:
    enabled: true
```

Tests count as not local on purpose, so CI never picks up the dashboard, the toolbar and the
observability defaults by accident. A test that needs Peekaboot says so:

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

Once `peekaboot.enabled` resolves to `true`, each feature has its own switch. Nothing below
is reachable while it doesn't.

| Feature | Switch | Also needs |
|---|---|---|
| dashboard and API | `peekaboot.enabled` | A servlet web application and Actuator, both present via the starter. |
| dev toolbar | `peekaboot.dev-toolbar` (detected) | A servlet web application and a Micrometer `Tracer` bean. The toolbar renders without tracing; its request-detail capture and its log capture are what need tracing on. |
| tracing | `peekaboot.tracing.enabled` (`true`) | A servlet web application. The trace store is created either way; the OpenTelemetry SDK, present via the starter, is what fills it. |
| startup and shutdown summaries, run history | `peekaboot.lifecycle.enabled` (`true`) | Nothing to collect them. The Lifecycle tab and `/peekaboot/api/lifecycle/**` also need a servlet web application. |
| persisted history | `peekaboot.storage.enabled` (detected) | A writable directory. A failed write is warned about and everything carries on in memory. |
| observability defaults | `peekaboot.enabled` | A servlet web application. |

On WebFlux or a non-web application there is nothing at `/peekaboot/**`, no trace store, no
insights collector, and the defaults [below](#what-peekaboot-sets-in-your-application) that hang
on `peekaboot.enabled` are not applied. `spring.main.web-application-type` decides this wherever
you set it, a plain property as much as `SpringApplicationBuilder.web(...)`. The summaries and
the run history still run in memory; storage decides whether the history is written. See
[Quick start]({{ '/docs/quick-start/' | relative_url }}).

## Properties

### `peekaboot`

| Property | Type | Default | Controls |
|---|---|---|---|
| `enabled` | boolean | detected | The master switch for the dashboard, its API, and Peekaboot's own defaults. |
| `dev-toolbar` | boolean | detected | The dev toolbar, correlated-log capture and full request/response detail capture. |
| `enable-unmasking` | boolean | `false` | Whether an `unmask=true` request may reveal real values from the Environment and Config data. |

`dev-toolbar` captures headers, query and form parameters and the resolved controller, not
request or response bodies. See [Dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}).

`enable-unmasking` changes nothing on its own. It allows the `unmask=true` parameter on
`GET /peekaboot/api/actuator/all/insights` and makes the "Show secrets" toggle appear. See
[Masking]({{ '/docs/security/' | relative_url }}#masking).

### `peekaboot.storage`

The only prefix that touches the filesystem. It decides whether the insights history and the
start/stop log outlive a restart.

| Property | Type | Default | Controls |
|---|---|---|---|
| `enabled` | boolean | detected | Whether anything is written at all. Off, both stores run from memory and never open a file. |
| `dir` | String | `${user.home}/.peekaboot/<groupId>.<artifactId>` | Where the files live. An explicit value is used verbatim, with no per-application subdirectory. |

The default directory sits outside your project on purpose, surviving a `mvn clean` and a
re-clone. `<groupId>.<artifactId>` comes from `build-info.properties`, so it needs a build that
generates one (the Spring Boot Maven plugin's `build-info` goal, or `springBoot { buildInfo() }`
in Gradle). Without it Peekaboot falls back to `spring.application.name`, then to a fixed
`application` folder. Two applications that share a name, or have none, share a directory, which
is the case worth setting `dir` for. Every character outside `A-Za-z0-9._-` becomes one dash,
accented and non-Latin letters included, and an id that comes out as `.` or `..` lands in
`application` too.

Two files land there:

| File | What it holds | Size |
|---|---|---|
| `insights.snapshot` | The insights rings, written at each `peekaboot.insights.persistence.interval` boundary and once more at shutdown. | About 5 MB at the default levels. |
| `lifecycle.jsonl` | The start and stop history, one JSON object per line. The log keeps at most 1000 events, roughly 500 runs, oldest dropped first, in memory and on disk alike. | Typically well under 400 KB; only the event count is capped. |

On a POSIX file system the directory is created `rwx------` and both files `rw-------`, owner
only. An existing directory keeps its permissions, and on Windows the platform defaults apply.

Neither file can fail your application. A snapshot is discarded and deleted when this version
can't read it, when it no longer matches your `peekaboot.insights.levels`, when it is older than
`peekaboot.insights.persistence.max-age` or when it is dated more than five minutes in the
future, and the rings start empty. A `lifecycle.jsonl` line that fails to parse or carries no
event type is skipped; the rest of the file still loads. A failed write is logged and everything
carries on in memory, each file warning once per run. Two instances on the same `dir`
overwrite each other's history.

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

**Service URL** appears whenever there is an embedded web server, and the two lines below build on that base. The scheme is `https` when
Spring Boot's own rule reads TLS as on. That rule looks at the whole bound `server.ssl` object,
not `server.ssl.enabled` alone, so a key store or an SSL bundle is enough by itself, and
`server.ssl.enabled: false` keeps the scheme `http` despite one. The port is the one actually
bound, `server.servlet.context-path` is appended where configured, and a `server.address` that
is unset, blank, `0.0.0.0` or `::` prints as `localhost`. **Swagger UI** appears when springdoc
is on the classpath, honouring `springdoc.swagger-ui.path`. **Peekaboot Dashboard** appears only
where the dashboard is served: a servlet application, Actuator present, `peekaboot.enabled`
true. Otherwise the line is omitted rather than printed as a 404.

### `peekaboot.tracing`

| Property | Type | Default | Controls |
|---|---|---|---|
| `enabled` | boolean | `true` | Whether the in-memory trace store exists at all. |
| `max-traces` | int | `1000` | Traces held in the **All** bucket, oldest evicted first. |
| `max-spans-per-trace` | int | `500` | Distinct spans kept per trace after duplicates from double-instrumented layers are folded away; oldest dropped past it, and the trace is flagged `TRUNCATED`. |
| `max-error-traces` | int | `100` | Traces held in the **Errors** bucket. |
| `max-slow-traces` | int | `100` | Traces held in the **Slow** bucket. |
| `slow-trace-threshold-ms` | long | `1000` | Total duration at or above which a trace enters the Slow bucket. |
| `max-logs-per-trace` | int | `500` | Correlated log entries kept per trace; only populated while the dev toolbar is on. |

See [Traces]({{ '/docs/traces/' | relative_url }}#the-three-buckets) for the three buckets
and [Issues]({{ '/docs/traces/' | relative_url }}#issues) for what `HIGH_QUERY_COUNT` checks.

### `peekaboot.ui.tracing`

These drive the dashboard's issue detection and badges, not what gets captured. See
[Issues]({{ '/docs/traces/' | relative_url }}#issues).

| Property | Type | Default | Controls |
|---|---|---|---|
| `slow-span-threshold-ms` | long | `100` | A span's own duration at or above this gets the SLOW issue and the SLOW badge on its trace row. |
| `very-slow-span-threshold-ms` | long | `500` | At or above this a span gets VERY_SLOW instead of SLOW; a span never gets both. |
| `slow-query-threshold-ms` | long | `50` | A database query span at or above this gets SLOW_QUERY; the trace detail's Queries tab labels a query SLOW at this same threshold, not the span thresholds above. |
| `high-query-count-threshold` | int | `5` | Direct database-query children one span may have before HIGH_QUERY_COUNT. |
| `high-trace-query-count-threshold` | int | `20` | Database queries a whole trace may run before HIGH_QUERY_COUNT, even if no single span crosses the threshold above. |

### `peekaboot.insights`

These control the metric collector behind the Insights tab. Whether its history outlives the
process is `peekaboot.storage.enabled` above. *What* it samples comes from a YAML file, see
[Insights]({{ '/docs/insights/' | relative_url }}#configuring-panels).

| Property | Type | Default | Controls |
|---|---|---|---|
| `enabled` | boolean | `true` | Whether the collector, the `/api/insights/**` endpoints and the Insights tab exist; also needs a Micrometer `MeterRegistry` bean. |
| `levels[n].interval` | Duration | `10s`, `1m`, `1h` | The sampling tick (level 0) and each aggregation window above it. |
| `levels[n].size` | int | `90`, `1440`, `720` | Entries kept per series at that level; `interval` &times; `size` is how far back the charts reach. |
| `config-location` | String | unset | A Spring resource location for the panel file, replacing the `peekaboot-insights.yml` lookup on the classpath root. Peekaboot's bundled panel defaults are still merged underneath it. |
| `persistence.interval` | Duration | the coarsest level's `interval` (`1h`) | How often the rings are written to `insights.snapshot`. Does nothing while storage is off. |
| `persistence.max-age` | Duration | the coarsest level's span (30 days) | How old a snapshot may be and still be loaded; past it every sample would be a gap. |

Setting `levels` replaces the whole list, so give every level you want. Each interval must be a
whole multiple of the previous one, and must span no more entries than the previous ring holds:
a `1m` level over a `10s` level needs six, so that ring's `size` must be at least 6. Either rule
broken fails startup.

Level 0 stores one number per series per tick; every higher level stores eight, seven statistics
plus a sample count the API withholds. That eighth column is why the memory is worth checking,
and Peekaboot logs the figure at startup. See [what it
costs]({{ '/docs/insights/' | relative_url }}#what-it-costs).

## What Peekaboot sets in your application

Peekaboot nudges a handful of Spring Boot and library defaults, so the dashboard has something
to show without you configuring Actuator or sampling by hand. All of them sit below every
property source you control, so anything you set wins.

The same holds for beans. Everything Peekaboot registers backs off when your application defines
a bean of the same type; two match on bean name instead, so replacing
`tracingInterceptorConfigurer` or `databaseMetadataList` takes the name.

| Property | Default without Peekaboot | Peekaboot default | Applies when | Why |
|---|---|---|---|---|
| `management.otlp.metrics.export.enabled` | `true` | `false` | always | The starter puts Micrometer's OTLP registry on the classpath; unconfigured, it would push metrics to `localhost:4318`. Telemetry must not leave the process unless you opt in. |
| `management.tracing.sampling.probability` | `0.1` | `1.0` | `peekaboot.enabled`, servlet web application | Every request reaches the Traces tab, not a one-in-ten slice. |
| `spring.jpa.properties.[hibernate.generate_statistics]` | `false` (Hibernate's own) | `true` | `peekaboot.enabled`, servlet web application | The `hibernate.*` meter panels on Insights need Hibernate's statistics. |
| `management.info.env.enabled` | `false` | `true` | `peekaboot.enabled`, servlet web application | Your `info.*` properties reach the Overview tab (not OS environment variables; the Environment tab covers those). |
| `management.info.java.enabled` | `false` | `true` | `peekaboot.enabled`, servlet web application | The Java card on Overview. |
| `management.info.os.enabled` | `false` | `true` | `peekaboot.enabled`, servlet web application | The System card on Overview. |
| `management.info.process.enabled` | `false` | `true` | `peekaboot.enabled`, servlet web application | PID, uptime, CPU count and memory on Overview. |
| `management.observations.annotations.enabled` | `false` | `true` | `peekaboot.enabled`, servlet web application | `@Observed`, `@Timed` and `@Counted` work without extra wiring. |
| `management.opentelemetry.tracing.export.schedule-delay` | `5s` | `200ms` | `peekaboot.enabled`, servlet web application, dev toolbar on | Spring Boot's span export delay is what separates a span ending from the toolbar seeing it; shortened so a trace is readable while you are still on the page. |

Traces and logs need no export switch, because Spring Boot only creates OTLP exporters for them
once you configure an endpoint. Nothing under `management.endpoint.*` is set and nothing on
`/actuator/**` changes: Peekaboot builds its own endpoint objects and reads them in-process,
so none of your endpoint settings decide what the dashboard sees, and it adds no exposure of
its own. See [Security]({{ '/docs/security/' | relative_url }}#what-peekaboot-does-not-do).

<div class="pk-callout pk-callout--warning" markdown="1">
**Some of these widen what is exposed, or cost something at runtime:**

- `management.info.env.enabled: true` publishes `info.*` through `/actuator/info` if you
  expose that endpoint.
- Sampling at `1.0` traces every request, for every exporter you have configured.
- Hibernate statistics carry a runtime cost.
- With the toolbar on, spans reach every exporter roughly 25 times more often than at Spring's
  default.

None of this matters on your own machine. It matters the moment `peekaboot.enabled` is `true`
somewhere reachable by anyone else. See [Do I want this in
production?]({{ '/docs/in-production/' | relative_url }}).
</div>

## Worked examples

### A longer, coarser insights history

To follow a long local session without the defaults' month-scale history, drop the top level
and lengthen the middle one:

```yaml
peekaboot:
  insights:
    levels:
      - interval: 10s
        size: 360      # 1 hour of tick resolution
      - interval: 2m
        size: 2160     # 3 days
```

That is (360 + 2160&times;8) &times; 8 bytes per series. It comes out about the same as the
defaults, spent differently. The startup log line reports where it actually landed; see [what
it costs]({{ '/docs/insights/' | relative_url }}#what-it-costs).

Memory follows `size` alone; `interval` is not in the formula. Halving level 0's `interval`
costs no memory, halves the window that level covers and doubles how often every meter is read.
Keeping the window means doubling `size`, which doubles the memory.

### Memory-constrained

Spans and logs are capped independently per trace, and the two caps add rather than multiply.
The All bucket's worst case is `max-traces` &times; (`max-spans-per-trace` +
`max-logs-per-trace`), so at the defaults (1000 / 500 / 500) 1000 &times; 1000 = 1,000,000
entries, not the 250,000,000 a naive triple product suggests. Turning all three down shrinks the ceiling
proportionally. The Errors and Slow buckets hold the same traces as All and keep
one alive after All has evicted it, so scale those down too:

```yaml
peekaboot:
  tracing:
    max-traces: 200
    max-spans-per-trace: 50
    max-logs-per-trace: 100
    max-error-traces: 25
    max-slow-traces: 25
```

This trades trace depth and history for memory. Requests that routinely produce more than 50
spans get truncated, so watch for the `TRUNCATED` badge before combining this with a
query-heavy workload.

### Query-heavy application

Some endpoints issue hundreds of queries by design, a report or a bulk export. They need span
capacity for those queries to survive truncation, and thresholds that do not flag normal
behaviour. The default cap of 500, counted after duplicates are folded away, covers most of
them. If the trace list shows a `TRUNCATED` badge on this endpoint, raise it:

```yaml
peekaboot:
  tracing:
    max-spans-per-trace: 1500
  ui:
    tracing:
      high-query-count-threshold: 15
      high-trace-query-count-threshold: 60
```

Raise `max-spans-per-trace` first, and only once the `TRUNCATED` badge shows truncation is real.
Raise the UI thresholds after that, only as far as what is normal here. Both count strictly, so
`15` means the sixteenth direct query child trips the issue. Set them too high and a genuine
regression stops triggering HIGH_QUERY_COUNT.
