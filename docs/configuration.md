---
title: Configuration
lead: When Peekaboot is on, every peekaboot.* property with its default, and what Peekaboot sets in your application.
permalink: /docs/configuration/
redirect_from:
  - /docs/how-activation-works/
  - /docs/auto-configured-defaults/
---

Looking for a property? The tables start at [Properties](#properties).

## When Peekaboot is on {#when-peekaboot-is-on}

Five properties default according to how the application was launched.

| Property | Local run | Deployment | Test | Turns on |
|---|---|---|---|---|
| `peekaboot.enabled` | `true` | `false` | `false` | The dashboard, its API, and Peekaboot's defaults. |
| `peekaboot.dev-toolbar.enabled` | `true` | `false` | `false` | The toolbar on your HTML pages. |
| `peekaboot.storage.enabled` | `true` | `false` | `false` | Writing the charts, the run history and the traces to disk. |
| `peekaboot.error-page.enabled` | `true` | `false` | `false` | The error page in place of Boot's whitelabel page. |
| `peekaboot.security.enabled` | `false` | `true` | `false` | Peekaboot's HTTP Basic guard on `/peekaboot/**`. |

Any value you set wins, in either direction: `application.yml`, an environment variable or a
system property. Each property is resolved on its own. Setting `peekaboot.enabled=true` on a
shared server gives you the dashboard, but no toolbar and no files in that host's home directory.

### What counts as a local run {#local-run}

- **Local run:** an IDE run, `mvn spring-boot:run` or `gradle bootRun` on your own machine,
  including DevTools restarts.
- **Test:** a JUnit or Cucumber run, or the AOT processing step of a build.
- **Deployment:** every other launch, such as `java -jar`, a war or a native image, and anything
  in a container.

### Containers, devcontainers and Codespaces {#container-markers}

Peekaboot detects Kubernetes, Docker and Podman containers, and a non-blank `container`
environment variable. Inside one, everything is off by default.

That includes VS Code Dev Containers and GitHub Codespaces. Turn the local features on in the
devcontainer's own configuration:

```yaml
peekaboot:
  enabled: true
  dev-toolbar:
    enabled: true
  storage:
    enabled: true
  error-page:
    enabled: true
```

### Turning it on in tests {#turning-it-on-in-tests}

Tests start with Peekaboot off, so CI never picks up the dashboard or its defaults. A test that
needs Peekaboot turns it on:

```java
@SpringBootTest(properties = "peekaboot.enabled=true")
```

<div class="pk-callout pk-callout--warning" markdown="1">
On a local run the dashboard and API have no authentication and answer [only the machine the
application runs on]({{ '/docs/security/' | relative_url }}#who-can-reach-peekaboot). On a
deployment with `peekaboot.enabled=true`, Peekaboot's guard challenges every `/peekaboot/**`
request until you switch it off to use your own security. Before setting
`peekaboot.enabled=true` anywhere other people can reach,
read [Production use]({{ '/docs/in-production/' | relative_url }}) and
[Security]({{ '/docs/security/' | relative_url }}).
</div>

### What each feature needs {#per-feature-switches}

Every feature also needs `peekaboot.enabled=true`.

| Feature | Switch | Also needs |
|---|---|---|
| Dashboard and API | `peekaboot.enabled` | A servlet web application with Spring MVC, and Actuator (the starter brings it). |
| Dev toolbar | `peekaboot.dev-toolbar.enabled` (detected) | A servlet web application. Request details and logs need tracing on. |
| Tracing | `peekaboot.tracing.enabled` (`true`) | A servlet web application. Request-detail and log capture come with it. |
| Insights | `peekaboot.insights.enabled` (`true`) | A servlet web application with Spring MVC and a Micrometer `MeterRegistry` bean. |
| Error page | `peekaboot.error-page.enabled` (detected) | A servlet web application with Spring MVC. |
| Peekaboot's guard | `peekaboot.security.enabled` (detected) | A servlet web application. |
| Summaries and run history | `peekaboot.lifecycle.enabled` (`true`) | Nothing. The Lifecycle tab and `/peekaboot/api/lifecycle/**` need a servlet web application. |
| Persisted history and traces | `peekaboot.storage.enabled` (detected) | A writable directory. A failed write logs a warning and Peekaboot carries on in memory. |
| [Spring Boot defaults](#what-peekaboot-sets-in-your-application) | `peekaboot.enabled` | A servlet web application. |

On WebFlux or a non-web application there is nothing at `/peekaboot/**`, no trace store, no
insights and none of the Spring Boot defaults. The startup summary and run history still work.
`spring.main.web-application-type` decides this. See [Quick start]({{ '/docs/quick-start/' | relative_url }}).

### Switch values {#switch-values}

These switches turn on only with `true`, in any case:

`peekaboot.enabled`, `peekaboot.dev-toolbar.enabled`, `peekaboot.storage.enabled`,
`peekaboot.storage.traces.enabled`, `peekaboot.error-page.enabled`,
`peekaboot.security.enabled`, `peekaboot.lifecycle.enabled`,
`peekaboot.tracing.enabled`, `peekaboot.tracing.async`, `peekaboot.tracing.event-listeners`,
`peekaboot.insights.enabled`.

`false`, `no`, `off` and `0` turn them off. Any other value stops startup with a report naming
the property and its value.

## Properties {#properties}

### General {#peekaboot}

| Property | Default | Effect |
|---|---|---|
| `peekaboot.enabled` | detected | Master switch for the dashboard, its API and Peekaboot's Spring Boot defaults. |
| `peekaboot.dev-toolbar.enabled` | detected | The dev toolbar on your HTML pages. |
| `peekaboot.unmasking.enabled` | `false` | Allows `unmask=true` on `/peekaboot/api/actuator/all/insights` to reveal the values that response masks. |

`unmasking.enabled` changes nothing on its own, see [Security, two opt-ins before a real value
is shown]({{ '/docs/security/' | relative_url }}#masking-opt-ins).

### Storage {#peekabootstorage}

| Property | Default | Effect |
|---|---|---|
| `peekaboot.storage.enabled` | detected | Whether anything is written. Off, every store lives in memory and never opens a file. |
| `peekaboot.storage.dir` | `${user.home}/.peekaboot/<groupId>.<artifactId>` | Where the files live. An explicit value is used as is, with no per-application subdirectory. |
| `peekaboot.storage.traces.enabled` | `true` | Whether traces, their logs and the error digest survive a restart while storage is on. `false` keeps them in memory only. |
| `peekaboot.storage.traces.flush-interval` | `1s` | How often trace data is written out. A crash usually loses the last interval. |
| `peekaboot.storage.traces.max-journal-size` | `64MB` | The journal size, counted in characters, past which it is compacted. |

Zero or a negative `flush-interval` or `max-journal-size` stops startup.

The default directory sits outside your project, so it survives `mvn clean`.
`<groupId>.<artifactId>` comes from `build-info.properties`, which the Spring Boot Maven plugin's
`build-info` goal or `springBoot { buildInfo() }` in Gradle generates. Without it the directory is
named after `spring.application.name`.

A second instance on a directory a running instance holds keeps everything in memory. See
[History is not saved although storage is
on]({{ '/docs/troubleshooting/' | relative_url }}#second-instance).

{% include facts/storage-files.md %}

On a POSIX file system Peekaboot creates the directory `rwx------` and every file `rw-------`.
An existing directory keeps its permissions. On Windows the platform defaults apply.

No file can fail your application. A file Peekaboot cannot use is dropped and the store starts
empty. A failed write logs one warning and Peekaboot carries on in memory.

### Peekaboot's guard {#peekabootsecurity}

| Property | Default | Effect |
|---|---|---|
| `peekaboot.security.enabled` | detected | Whether Peekaboot's HTTP Basic guard protects `/peekaboot/**`. |
| `peekaboot.security.username` | derived | The username the guard accepts. |
| `peekaboot.security.password` | unset | A fixed password. Nothing is generated or written to disk. |
| `peekaboot.security.credentials-file` | `security.properties` in the storage directory | Where the generated password's hash is stored. A path you set is written even while storage is off. Readable by its owner only. |

The username and password rules, and how to keep a generated password across restarts, are under
[Security, Peekaboot's guard]({{ '/docs/security/' | relative_url }}#peekaboots-guard).

### Remote access {#peekabootremoteaccess}

| Property | Default | Effect |
|---|---|---|
| `peekaboot.remote-access.enabled` | `false` | Lets clients other than this machine reach Peekaboot on a local run. Without effect once the guard is armed or on a deployment. |

What a local run answers without it is under [Security, who can reach
Peekaboot]({{ '/docs/security/' | relative_url }}#who-can-reach-peekaboot).

### Error page {#peekabooterrorpage}

| Property | Default | Effect |
|---|---|---|
| `peekaboot.error-page.enabled` | detected | Renders Peekaboot's error page in place of Spring Boot's whitelabel page. |
| `peekaboot.error-page.override` | `false` | Renders Peekaboot's page even where the application has its own error page. |

See [Error page]({{ '/docs/error-page/' | relative_url }}) for what the page shows, when it
backs off and what `override` changes.

### Stack-trace folding {#peekabootstacktrace}

| Property | Default | Effect |
|---|---|---|
| `peekaboot.stack-trace.fold` | `true` | Collapses framework frames behind a disclosure on the error page and in the Logs tab. Off, every frame is shown. |
| `peekaboot.stack-trace.exclude` | unset | Patterns for the frames that fold. A non-empty list replaces the built-in list. |

A frame folds when its line contains a pattern as a substring. Your application's own frames
never fold. The built-in list is `java.lang.reflect.Method`, `jdk.internal.reflect`,
`sun.reflect`, `org.apache.catalina`, `org.apache.coyote`, `org.apache.tomcat`,
`org.springframework`, `org.thymeleaf`, `org.attoparser`, `jakarta.servlet`, `net.sf.cglib`,
`ByCGLIB`, `org.zalando.logbook`, `net.ttddyy.dsproxy`, `com.mysql` and `org.peekaboot`. Use
`fold: false` to stop folding, since `exclude: []` counts as unset.

### Lifecycle {#peekabootlifecycle}

| Property | Default | Effect |
|---|---|---|
| `peekaboot.lifecycle.enabled` | `true` | The startup and shutdown summaries and the run history behind the Lifecycle tab and `/peekaboot/api/lifecycle/**`. |

The startup summary shows the application name, build info, server, dashboard and datasource.
The shutdown summary shows the uptime and the start and stop times.

#### The URLs in the summary {#the-urls-in-the-summary}

```
 Service URL: http://localhost:8080
 Swagger UI: http://localhost:8080/swagger-ui.html
 Peekaboot Dashboard: http://localhost:8080/peekaboot/
```

Swagger UI appears with springdoc. The dashboard line appears only where the dashboard is
served.

### Tracing {#peekaboottracing}

| Property | Default | Effect |
|---|---|---|
| `peekaboot.tracing.enabled` | `true` | Whether the in-memory trace store exists, and with it the capture of each request's headers, parameters, resolved controller and log lines. Request and response bodies are not captured. |
| `peekaboot.tracing.async` | `true` | Records a span for each task run on one of Spring's task executors. The span fails when the task throws. Needs `spring.task.execution.propagate-context`, see [Traces, background work]({{ '/docs/traces/' | relative_url }}#background-work). |
| `peekaboot.tracing.event-listeners` | `true` | Records a span for each call of an `@EventListener` method. An `@Async` listener also needs `spring.task.execution.propagate-context`. See [Traces, event listeners]({{ '/docs/traces/' | relative_url }}#event-listeners). |
| `peekaboot.tracing.max-traces` | `1000` | Traces kept in the All bucket, oldest evicted first. |
| `peekaboot.tracing.max-spans-per-trace` | `500` | Spans kept per trace, oldest dropped past it. The trace counts them in `droppedSpans` and shows a `TRUNCATED` badge. |
| `peekaboot.tracing.max-error-traces` | `100` | Traces kept in the Errors bucket. |
| `peekaboot.tracing.max-slow-traces` | `100` | Traces kept in the Slow bucket. |
| `peekaboot.tracing.slow-trace-threshold-ms` | `1000` | Duration in milliseconds, background async work excluded, at or above which a trace enters the Slow bucket and shows a SLOW badge. |
| `peekaboot.tracing.max-logs-per-trace` | `500` | Log entries kept per trace. |
| `peekaboot.tracing.max-untraced-logs` | `1000` | Log lines written outside any trace that are kept for the [log search]({{ '/docs/api/' | relative_url }}#log-search), oldest dropped first. |

`max-traces` and `max-spans-per-trace` must be at least `1`. For the other limits `0` keeps none.
A value below the minimum stops startup.

See [Traces, buckets, limits and memory]({{ '/docs/traces/' | relative_url }}#the-three-buckets)
for the worst case.

#### Issue thresholds {#issue-thresholds}

These decide the issues on a trace's spans. They do not change what is captured. See
[Issues]({{ '/docs/traces/' | relative_url }}#issues).

| Property | Default | Effect |
|---|---|---|
| `peekaboot.tracing.slow-span-threshold-ms` | `100` | A span whose self time is at or above this gets SLOW. |
| `peekaboot.tracing.very-slow-span-threshold-ms` | `500` | At or above this a span's self time gets VERY_SLOW instead of SLOW. |
| `peekaboot.tracing.slow-query-threshold-ms` | `50` | A database query at or above this gets SLOW_QUERY and a SLOW label in the Queries tab. |
| `peekaboot.tracing.repeated-query-threshold` | `5` | A span that runs the same statement, literals ignored, this many times or more gets REPEATED_QUERY. At least `2`; a lower value stops startup. |

### Insights {#peekabootinsights}

Which metrics the collector samples comes from a YAML file, see
[Insights]({{ '/docs/insights/' | relative_url }}#configuring-panels). Whether the history
survives a restart is [`peekaboot.storage.enabled`](#peekabootstorage).

| Property | Default | Effect |
|---|---|---|
| `peekaboot.insights.enabled` | `true` | The collector, the `/peekaboot/api/insights/**` endpoints and the Insights tab. |
| `peekaboot.insights.levels[n].interval` | `10s`, `1m`, `1h` | The sampling tick (level 0) and each coarser aggregation window. At most 16 levels. |
| `peekaboot.insights.levels[n].size` | `90`, `1440`, `720` | Entries kept per series at that level, at most 1,000,000. `interval` &times; `size` is how far back the charts reach. |
| `peekaboot.insights.config-location` | unset, so `peekaboot-insights.yml` on the classpath root | A Spring resource location for the panel file, merged over Peekaboot's bundled panels. A location that names nothing stops startup. |
| `peekaboot.insights.persistence.interval` | `5m` | How often the history is written to `insights.snapshot`. A crash loses at most this much. No effect while storage is off. |
| `peekaboot.insights.persistence.max-age` | the coarsest level's span (30 days) | The oldest snapshot that is still loaded at startup. |
| `peekaboot.insights.problems.cpu-high-percent` | `80` | [`CPU_HIGH`]({{ '/docs/api/' | relative_url }}#problems): the median process CPU, in percent. |
| `peekaboot.insights.problems.gc-overhead-percent` | `10` | `GC_OVERHEAD`: the median share of CPU time spent collecting garbage, in percent. |
| `peekaboot.insights.problems.heap-near-max-percent` | `90` | `HEAP_NEAR_MAX`: the median heap in use as a share of its maximum, in percent. |
| `peekaboot.insights.problems.thread-growth` | `50` | `THREAD_GROWTH`: how far the fewest live threads rise from a window's first quarter to its last. |
| `peekaboot.insights.problems.pool-waiting` | `1` | `POOL_WAITING`: connections waiting for the pool at once. |
| `peekaboot.insights.problems.server-errors-percent` | `5` | `SERVER_ERRORS`: the share of HTTP requests answered with a 5xx, in percent. |
| `peekaboot.insights.problems.error-logs` | `1` | `ERROR_LOGS`: lines logged at ERROR in the window. |

Setting `levels` replaces the whole list, so list every level you want. An invalid level set
stops startup with a message naming the problem.

Memory follows `size`, not `interval`, and Peekaboot logs the total at startup. See [what it
costs]({{ '/docs/insights/' | relative_url }}#what-it-costs).

## Spring Boot defaults Peekaboot changes {#what-peekaboot-sets-in-your-application}

Anything you set yourself wins. Peekaboot sets no `spring.task.execution.*` property.

| Property | Spring Boot default | Peekaboot default | Applies when | Effect |
|---|---|---|---|---|
| `management.otlp.metrics.export.enabled` | `true` | `false` | always | Metrics are not pushed to `localhost:4318`. Nothing leaves the process unless you opt in. |
| `jdbc.datasource-proxy.enabled` | `true` (datasource-micrometer's own) | `false` | Peekaboot off | None of your DataSources is wrapped. Set it to `true` if you use datasource-micrometer yourself. |
| `management.tracing.sampling.probability` | `0.1` | `1.0` | `peekaboot.enabled`, servlet web application | Every request reaches the Traces tab, and every exporter you configured. |
| `spring.jpa.properties[hibernate.generate_statistics]` | `false` (Hibernate's own) | `true` | `peekaboot.enabled`, servlet web application | The `hibernate.*` panels on Insights get data. Hibernate statistics carry a runtime cost. |
| `management.observations.annotations.enabled` | `false` | `true` | `peekaboot.enabled`, servlet web application | `@Observed`, `@Timed` and `@Counted` work without extra wiring and record for every registry and exporter you configured. |
| `management.opentelemetry.tracing.export.schedule-delay` | `5s` | `200ms` | `peekaboot.enabled`, servlet web application, dev toolbar on | The toolbar shows a request's trace while you are still on the page. Spans reach every exporter about 25 times more often than at Spring's default. |

Traces and logs need no export switch. Spring Boot creates OTLP exporters for them only once
you configure an endpoint. Peekaboot changes nothing on `/actuator/**`. See
[Security]({{ '/docs/security/' | relative_url }}#what-peekaboot-does-not-do).

<div class="pk-callout pk-callout--warning" markdown="1">
On your own machine these defaults are harmless. Check them before `peekaboot.enabled` is `true`
anywhere other people can reach. See [Production use]({{ '/docs/in-production/' | relative_url }}).
</div>

## Examples {#worked-examples}

### A longer, coarser insights history {#a-longer-coarser-insights-history}

Replace the minute and hourly levels with one two-minute level to follow a long local session:

```yaml
peekaboot:
  insights:
    levels:
      - interval: 10s
        size: 360      # 1 hour of tick resolution
      - interval: 2m
        size: 2160     # 3 days
```

That is about the same memory as the defaults. The startup log reports the actual figure. See
[what it costs]({{ '/docs/insights/' | relative_url }}#what-it-costs).

### Memory-constrained {#memory-constrained}

Errors and Slow can keep a trace after All has evicted it, so scale them down with All. [Traces,
buckets, limits and memory]({{ '/docs/traces/' | relative_url }}#the-three-buckets) works out the
worst case.

```yaml
peekaboot:
  tracing:
    max-traces: 200
    max-spans-per-trace: 50
    max-logs-per-trace: 100
    max-untraced-logs: 200
    max-error-traces: 25
    max-slow-traces: 25
```

Requests with more than 50 spans get truncated, which shows as the `TRUNCATED` badge.

### Query-heavy application {#query-heavy-application}

A report or bulk export can issue hundreds of queries. Past the span cap, spans are dropped and
the row's query count under-reports. If the trace list shows `TRUNCATED` for one, raise the cap.
Every span kept costs memory.

```yaml
peekaboot:
  tracing:
    max-spans-per-trace: 1500
```
