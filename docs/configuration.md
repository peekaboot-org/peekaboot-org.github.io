---
title: Configuration
lead: When Peekaboot is on, every peekaboot.* property with its default, and what Peekaboot sets in your application.
permalink: /docs/configuration/
redirect_from:
  - /docs/how-activation-works/
  - /docs/auto-configured-defaults/
---

## When Peekaboot is on {#when-peekaboot-is-on}

Six properties default according to how the application was launched.

| Property | Local run | Anywhere else | Turns on |
|---|---|---|---|
| `peekaboot.enabled` | `true` | `false` | The dashboard, its API, and Peekaboot's defaults. |
| `peekaboot.dev-toolbar` | `true` | `false` | The toolbar, log capture and request-detail capture. |
| `peekaboot.storage.enabled` | `true` | `false` | Writing the charts and the run history to disk. |
| `peekaboot.error-page.enabled` | `true` | `false` | The error page in place of Boot's whitelabel page. |
| `peekaboot.stack-trace.fold` | `true` | `false` | Folding framework frames on the error page and in the Logs tab. |
| `peekaboot.security.enabled` | `false` | `true` | Peekaboot's HTTP Basic guard on `/peekaboot/**`. |

Any value you set wins, in either direction: `application.yml`, an environment variable or a
system property. Each property is resolved on its own. Setting `peekaboot.enabled=true` on a
shared server gives you the dashboard, but no toolbar and no files in that host's home directory.

Tests resolve `peekaboot.security.enabled` to `false`, like a local run. See
[`peekaboot.security`](#peekabootsecurity).

### Where it turns itself on {#local-run}

A local run is an IDE run, `mvn spring-boot:run` or `gradle bootRun` on your own machine.
Spring Boot DevTools restarts keep counting as local.

Everything else counts as not local, so the table above resolves to its "Anywhere else" column:
`java -jar`, a war, a native image, an AOT run, a test, a Jib image, Spring Boot's `extract`
layout, a `java -cp` of jars, and anything in a container.

A `java -cp target/classes:…` launch on a host outside a container counts as local. If you
deploy that way, set `peekaboot.enabled=false`.

### Containers, devcontainers and Codespaces {#container-markers}

Peekaboot detects Kubernetes, Docker and Podman, and any container whose `/proc/1/cgroup`
names `docker`, `kubepods` or `containerd`. Inside one, everything is off by default.

That includes VS Code Dev Containers and GitHub Codespaces. Turn the local features on in the
devcontainer's own configuration:

```yaml
peekaboot:
  enabled: true
  dev-toolbar: true
  storage:
    enabled: true
  error-page:
    enabled: true
  stack-trace:
    fold: true
```

### Turning it on in tests {#turning-it-on-in-tests}

Tests start with Peekaboot off, so CI never picks up the dashboard or its defaults. A test that
needs Peekaboot turns it on:

```java
@SpringBootTest(properties = "peekaboot.enabled=true")
```

<div class="pk-callout pk-callout--warning" markdown="1">
On a local run, the default, the dashboard and API have no authentication. Outside local
development Peekaboot's guard challenges every `/peekaboot/**` request that your own security
has not already authenticated. The guard is a stop-gap for when nothing else protects the
dashboard. Before setting `peekaboot.enabled=true` anywhere other people can reach, read [Do I
want this in production?]({{ '/docs/in-production/' | relative_url }}) and
[Security]({{ '/docs/security/' | relative_url }}).
</div>

### What each feature needs {#per-feature-switches}

Every feature also needs `peekaboot.enabled=true`.

| Feature | Switch | Also needs |
|---|---|---|
| Dashboard and API | `peekaboot.enabled` | A servlet web application and Actuator. The starter brings Actuator. |
| Dev toolbar | `peekaboot.dev-toolbar` (detected) | A servlet web application. Request-detail and log capture also need tracing on. |
| Tracing | `peekaboot.tracing.enabled` (`true`) | A servlet web application. The starter brings the OpenTelemetry SDK that fills the trace store. |
| Insights | `peekaboot.insights.enabled` (`true`) | A servlet web application and a Micrometer `MeterRegistry` bean. |
| Error page | `peekaboot.error-page.enabled` (detected) | A servlet web application with Spring MVC. |
| Dashboard login | `peekaboot.security.enabled` (detected) | A servlet web application. |
| Startup and shutdown summaries, run history | `peekaboot.lifecycle.enabled` (`true`) | Nothing else. The Lifecycle tab and `/peekaboot/api/lifecycle/**` need a servlet web application. |
| Persisted history | `peekaboot.storage.enabled` (detected) | A writable directory. A failed write logs a warning and Peekaboot carries on in memory. |
| Spring Boot defaults [below](#what-peekaboot-sets-in-your-application) | `peekaboot.enabled` | A servlet web application. |

On WebFlux or a non-web application there is nothing at `/peekaboot/**`, no trace store, no
insights and none of the Spring Boot defaults. The startup summary and run history still work.
`spring.main.web-application-type` decides this, whether you set it as a property or through
`SpringApplicationBuilder.web(...)`. See [Quick start]({{ '/docs/quick-start/' | relative_url }}).

## Properties {#properties}

### General {#peekaboot}

| Property | Default | Effect |
|---|---|---|
| `peekaboot.enabled` | detected | Master switch for the dashboard, its API and Peekaboot's Spring Boot defaults. |
| `peekaboot.dev-toolbar` | detected | The dev toolbar, correlated-log capture and request-detail capture. |
| `peekaboot.enable-unmasking` | `false` | Allows `unmask=true` to reveal real values from the Environment and Config data. |

The toolbar captures headers, query and form parameters and the resolved controller. It does not
capture request or response bodies. See [Dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}).

`enable-unmasking` changes nothing on its own. It allows the `unmask=true` parameter on
`GET /peekaboot/api/actuator/all/insights` and shows the "Show secrets" toggle. See
[Masking]({{ '/docs/security/' | relative_url }}#masking).

### Storage {#peekabootstorage}

Storage decides whether the insights history and the start/stop log survive a restart.

| Property | Default | Effect |
|---|---|---|
| `peekaboot.storage.enabled` | detected | Whether anything is written. Off, both stores live in memory and never open a file. |
| `peekaboot.storage.dir` | `${user.home}/.peekaboot/<groupId>.<artifactId>` | Where the files live. An explicit value is used as is, with no per-application subdirectory. |

The default directory sits outside your project, so it survives `mvn clean` and a re-clone.
`<groupId>.<artifactId>` comes from `build-info.properties`. Generate it with the Spring Boot
Maven plugin's `build-info` goal or `springBoot { buildInfo() }` in Gradle. Without it Peekaboot
uses `spring.application.name`, then a folder named `application`.

Two applications with the same name, or with none, share a directory. Two instances on the same
directory overwrite each other's history. Set `dir` in both cases. Every character outside
`A-Za-z0-9._-` in the name becomes a dash.

| File | Contents | Size |
|---|---|---|
| `insights.snapshot` | The insights history, written every `peekaboot.insights.persistence.interval` and at shutdown. | About 5 MB at the default levels. |
| `lifecycle.jsonl` | The start and stop history, capped at 1000 events (about 500 runs), oldest dropped first. | Typically well under 400 KB. |

On a POSIX file system Peekaboot creates the directory `rwx------` and both files `rw-------`.
An existing directory keeps its permissions. On Windows the platform defaults apply.

Neither file can fail your application. A snapshot that is unreadable, older than
`peekaboot.insights.persistence.max-age` or written for different levels is dropped, and the
history starts empty. A failed write logs one warning per file and run, and
Peekaboot carries on in memory.

### Dashboard login {#peekabootsecurity}

| Property | Default | Effect |
|---|---|---|
| `peekaboot.security.enabled` | detected | Whether Peekaboot's HTTP Basic guard protects `/peekaboot/**`. |
| `peekaboot.security.username` | `<artifact>-admin` | The username the guard accepts. |
| `peekaboot.security.password` | unset | A fixed password. Nothing is generated or written to disk. |
| `peekaboot.security.credentials-file` | `security.properties` in the storage directory | Where the generated password's hash is stored. A path you set is written even while storage is off. |

`enabled` is on for a deployment launch and off for local runs and tests. Only `true` and
`false` count. Any other value, `yes` for example, leaves the guard off.

`username` uses the build's artifact id, then `spring.application.name`, then `peekaboot`. The
suffix `-admin` is always appended.

With `password` unset, Peekaboot generates a 26-character password on first start, prints it in
the `Peekaboot Security` block of the startup log and stores only its hash. The hash goes to
`security.properties` in the [storage directory](#peekabootstorage). With storage off, the
default outside local development, nothing is written and the password changes on every restart.
The startup log says so. Set `credentials-file` or `password` to keep it stable.

Failed logins are not throttled. See [Security, securing the
dashboard]({{ '/docs/security/' | relative_url }}#securing-the-dashboard).

### Error page {#peekabooterrorpage}

| Property | Default | Effect |
|---|---|---|
| `peekaboot.error-page.enabled` | detected | Renders Peekaboot's error page in place of Spring Boot's whitelabel page. |
| `peekaboot.error-page.override` | `false` | Renders Peekaboot's page even where the application has its own error page. |

The page shows the status and reason, the request line, the exception class and message, and
the stack trace with your own frames marked.

By default Peekaboot backs off when the application has its own error page: an `error` view
bean, an `error` template or a static `error/*.html`. It also stays off while
`spring.web.error.whitelabel.enabled` is `false`.

To keep a branded error page in production and see Peekaboot's page while developing, set
`peekaboot.error-page.override: true` in your local profile. Peekaboot's page then wins wherever
`enabled` is `true`. It also wins over an `@ControllerAdvice` or `@ExceptionHandler` that
renders your error page, and the whitelabel setting no longer applies. Requests that ask for
JSON are left alone.

The error page carries the dev toolbar, which reports the failed request. See [Dev toolbar,
pages that get the bar]({{ '/docs/dev-toolbar/' | relative_url }}#where-the-bar-appears) and
[Security, the error page]({{ '/docs/security/' | relative_url }}#the-error-page).

### Stack-trace folding {#peekabootstacktrace}

| Property | Default | Effect |
|---|---|---|
| `peekaboot.stack-trace.fold` | detected | Collapses framework frames behind a disclosure on the error page and in the Logs tab. Off, every frame is shown. |
| `peekaboot.stack-trace.exclude` | unset | Patterns for the frames that fold. A non-empty list replaces the default list. |

A frame folds when its line contains a pattern as a substring. Your application's own frames
never fold.

`exclude` comes from the first of these sources that is set:

1. `peekaboot.stack-trace.exclude`, if it is a non-empty list. You cannot add to the built-in
   list, only replace it.
2. The patterns in the `%wEx{...}` block of your `logging.exception-conversion-word`. A block
   with no patterns, such as `%wEx{full}`, folds nothing.
3. The built-in list:

   ```
   java.lang.reflect.Method
   jdk.internal.reflect
   sun.reflect
   org.apache.catalina
   org.apache.coyote
   org.apache.tomcat
   org.springframework
   org.thymeleaf
   org.attoparser      # Thymeleaf's own parser
   jakarta.servlet
   net.sf.cglib
   ByCGLIB             # a CGLIB-generated proxy class name, not a package
   org.zalando.logbook
   net.ttddyy.dsproxy
   com.mysql
   ```

`exclude: []` does not stop folding. It counts as unset and falls through to the next source.
Use `fold: false` instead.

A captured stack trace is cut at 1000 lines, whatever `fold` says, and ends with a
`... N lines omitted` marker. A `StackOverflowError` is the usual case. The worst case for the
whole trace store is 1000 lines &times; `max-logs-per-trace` &times; (`max-traces` +
`max-error-traces` + `max-slow-traces`).

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

Service URL appears whenever there is an embedded web server. It uses the bound port and
appends `server.servlet.context-path`. A `server.address` that is unset, blank, `0.0.0.0` or
`::` prints as `localhost`.

The scheme is `https` when Spring Boot considers TLS on. A key store or an SSL bundle under
`server.ssl` is enough. `server.ssl.enabled: false` keeps it `http`.

Swagger UI appears when springdoc is on the classpath and honours `springdoc.swagger-ui.path`.
Peekaboot Dashboard appears only where the dashboard is served: a servlet application with
Actuator and `peekaboot.enabled=true`.

### Tracing {#peekaboottracing}

| Property | Default | Effect |
|---|---|---|
| `peekaboot.tracing.enabled` | `true` | Whether the in-memory trace store exists. |
| `peekaboot.tracing.async` | `true` | Records a span for each task run on one of Spring's task executors. Needs `spring.task.execution.propagate-context`, below. |
| `peekaboot.tracing.max-traces` | `1000` | Traces kept in the All bucket, oldest evicted first. |
| `peekaboot.tracing.max-spans-per-trace` | `500` | Spans kept per trace, counted after duplicates are merged. Past it the oldest are dropped and the trace is marked `TRUNCATED`. |
| `peekaboot.tracing.max-error-traces` | `100` | Traces kept in the Errors bucket. |
| `peekaboot.tracing.max-slow-traces` | `100` | Traces kept in the Slow bucket. |
| `peekaboot.tracing.slow-trace-threshold-ms` | `1000` | Total duration at or above which a trace enters the Slow bucket. |
| `peekaboot.tracing.max-logs-per-trace` | `500` | Log entries kept per trace. Only filled while the dev toolbar is on. |

See [Traces]({{ '/docs/traces/' | relative_url }}#the-three-buckets) for the buckets and
[background work]({{ '/docs/traces/' | relative_url }}#background-work) for what `async` shows.

#### Background tasks: required Spring settings {#background-tasks-required-spring-settings}

Peekaboot records no span for a background task until your application sets this:

```yaml
spring:
  task:
    execution:
      propagate-context: true
```

<div class="pk-callout pk-callout--warning" markdown="1">
Peekaboot does not set `spring.task.execution.propagate-context` for you. It changes what every
task on the executor sees, so the decision stays with your application.

If your application declares its own `Executor` bean, Spring Boot stops creating its own task
executor, and neither context propagation nor Peekaboot reaches your tasks. Set
`spring.task.execution.mode=force` to keep Boot's executor.
</div>

### Issue thresholds {#peekabootuitracing}

These decide the dashboard's issues and badges. They do not change what is captured. See
[Issues]({{ '/docs/traces/' | relative_url }}#issues).

| Property | Default | Effect |
|---|---|---|
| `peekaboot.ui.tracing.slow-span-threshold-ms` | `100` | A span whose own duration is at or above this gets SLOW, and its trace row a SLOW badge. |
| `peekaboot.ui.tracing.very-slow-span-threshold-ms` | `500` | At or above this a span gets VERY_SLOW instead of SLOW. |
| `peekaboot.ui.tracing.slow-query-threshold-ms` | `50` | A database query at or above this gets SLOW_QUERY and a SLOW label in the Queries tab. |

### Insights {#peekabootinsights}

These configure the collector behind the Insights tab. Which metrics it samples comes from a
YAML file, see [Insights]({{ '/docs/insights/' | relative_url }}#configuring-panels). Whether
the history survives a restart is [`peekaboot.storage.enabled`](#peekabootstorage).

| Property | Default | Effect |
|---|---|---|
| `peekaboot.insights.enabled` | `true` | The collector, the `/api/insights/**` endpoints and the Insights tab. |
| `peekaboot.insights.levels[n].interval` | `10s`, `1m`, `1h` | The sampling tick (level 0) and each coarser aggregation window. |
| `peekaboot.insights.levels[n].size` | `90`, `1440`, `720` | Entries kept per series at that level. `interval` &times; `size` is how far back the charts reach. |
| `peekaboot.insights.config-location` | `peekaboot-insights.yml` on the classpath root | A Spring resource location for the panel file. Peekaboot's bundled panels are still merged underneath. |
| `peekaboot.insights.persistence.interval` | the coarsest level's `interval` (`1h`) | How often the history is written to `insights.snapshot`. Does nothing while storage is off. |
| `peekaboot.insights.persistence.max-age` | the coarsest level's span (30 days) | The oldest snapshot that is still loaded at startup. |

Setting `levels` replaces the whole list, so list every level you want. Startup fails unless
all of these hold:

- At most 16 levels.
- Every `interval` and `size` is greater than zero, and every `size` is at most 1,000,000.
- Each `interval` is a whole multiple of the one before it.
- Each `interval` fits in the level below it. A `1m` level over a `10s` level spans six entries,
  so the `10s` level needs a `size` of at least 6.
- `persistence.interval` and `persistence.max-age`, when set, are greater than zero.

Memory follows `size`, not `interval`. Level 0 stores one number per series per entry. Every
higher level stores eight. Peekaboot logs the total at startup. See [what it
costs]({{ '/docs/insights/' | relative_url }}#what-it-costs).

## Spring Boot defaults Peekaboot changes {#what-peekaboot-sets-in-your-application}

Peekaboot changes a few Spring Boot and library defaults so the dashboard has data without
further setup. Anything you set yourself wins, and every bean Peekaboot registers backs off when
you define your own. Peekaboot sets no `spring.task.execution.*` property.

| Property | Spring Boot default | Peekaboot default | Applies when | Why |
|---|---|---|---|---|
| `management.otlp.metrics.export.enabled` | `true` | `false` | always | The starter brings Micrometer's OTLP registry, which would otherwise push metrics to `localhost:4318`. Nothing leaves the process unless you opt in. |
| `management.tracing.sampling.probability` | `0.1` | `1.0` | `peekaboot.enabled`, servlet web application | Every request reaches the Traces tab. |
| `spring.jpa.properties.[hibernate.generate_statistics]` | `false` (Hibernate's own) | `true` | `peekaboot.enabled`, servlet web application | The `hibernate.*` panels on Insights need Hibernate's statistics. |
| `management.info.env.enabled` | `false` | `true` | `peekaboot.enabled`, servlet web application | Your `info.*` properties show on the Overview tab. OS environment variables are on the Environment tab. |
| `management.info.java.enabled` | `false` | `true` | `peekaboot.enabled`, servlet web application | The Java card on Overview. |
| `management.info.os.enabled` | `false` | `true` | `peekaboot.enabled`, servlet web application | The System card on Overview. |
| `management.info.process.enabled` | `false` | `true` | `peekaboot.enabled`, servlet web application | PID, uptime, CPU count and memory on Overview. |
| `management.observations.annotations.enabled` | `false` | `true` | `peekaboot.enabled`, servlet web application | `@Observed`, `@Timed` and `@Counted` work without extra wiring. |
| `management.opentelemetry.tracing.export.schedule-delay` | `5s` | `200ms` | `peekaboot.enabled`, servlet web application, dev toolbar on | The toolbar shows a request's trace while you are still on the page. |

Traces and logs need no export switch. Spring Boot creates OTLP exporters for them only once
you configure an endpoint. Peekaboot sets nothing under `management.endpoint.*`, changes nothing
on `/actuator/**`, and your endpoint settings do not affect what the dashboard shows. See
[Security]({{ '/docs/security/' | relative_url }}#what-peekaboot-does-not-do).

<div class="pk-callout pk-callout--warning" markdown="1">
**Some of these widen what is exposed, or cost something at runtime:**

- `management.info.env.enabled: true` publishes `info.*` through `/actuator/info` if you
  expose that endpoint.
- Sampling at `1.0` traces every request, for every exporter you have configured.
- Hibernate statistics carry a runtime cost.
- With the toolbar on, spans reach every exporter roughly 25 times more often than at Spring's
  default.

On your own machine this is harmless. Check it before `peekaboot.enabled` is `true` anywhere
other people can reach. See [Do I want this in
production?]({{ '/docs/in-production/' | relative_url }}).
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

That is (360 + 2160&times;8) &times; 8 bytes per series, about the same as the defaults. The
startup log reports the actual figure. See [what it
costs]({{ '/docs/insights/' | relative_url }}#what-it-costs).

Halving level 0's `interval` costs no memory. It halves the window that level covers and
doubles how often every meter is read. Keeping the window means doubling `size`, which doubles
the memory.

### Memory-constrained {#memory-constrained}

Spans and logs are capped separately per trace. The All bucket holds at most `max-traces`
&times; (`max-spans-per-trace` + `max-logs-per-trace`) entries: 1,000,000 at the defaults. The
Errors and Slow buckets can keep a trace after All has evicted it, so scale them down too:

```yaml
peekaboot:
  tracing:
    max-traces: 200
    max-spans-per-trace: 50
    max-logs-per-trace: 100
    max-error-traces: 25
    max-slow-traces: 25
```

Requests with more than 50 spans get truncated. Watch for the `TRUNCATED` badge, especially
with query-heavy endpoints.

### Query-heavy application {#query-heavy-application}

A report or bulk export can issue hundreds of queries. Past the span cap, spans are dropped and
the row's query count under-reports. The default of 500, counted after duplicates are merged,
covers most endpoints. If the trace list shows `TRUNCATED` for one, raise the cap:

```yaml
peekaboot:
  tracing:
    max-spans-per-trace: 1500
```

Every span kept costs memory, so raise it only once `TRUNCATED` shows up.
