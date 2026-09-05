---
title: Do I want this in production?
lead: What Peekaboot is for, what it costs while it is on, and what deploying does to it.
permalink: /docs/in-production/
---

## What Peekaboot is for

The ten seconds after you hit a page on your own machine: the toolbar on that page, the
request's trace, its queries and its logs, with no collector, agent or backend to run
first. It is not a smaller Grafana. Past one process you want a real tracing backend, and
[Tracing vs distributed
tracing]({{ '/docs/traces/' | relative_url }}#tracing-vs-distributed-tracing) marks where
the line falls.

Actuator's data is read in-process, so Peekaboot changes neither
`management.endpoints.web.exposure` nor what `/actuator/**` answers. Micrometer's OTLP
metrics push is switched off, so telemetry never leaves the process by accident. Your own
OTLP or Zipkin exporters and sampling configuration keep working: Peekaboot's store is one
more destination for the same spans.

One exception, confined to a [local run]({{ '/docs/configuration/' | relative_url }}#local-run):
there Peekaboot sets `management.endpoint.env.show-values` and `.configprops.show-values`
to `always`, which widens your own `/actuator/env` and `/actuator/configprops` too if you
expose them. See
[Security]({{ '/docs/security/' | relative_url }}#show-values-always-only-on-a-local-run).

## What it cannot do

- **One process only.** No joining a request across services, no aggregation across
  instances, no alerting.
- **Short retention.** 1000 traces, then the oldest goes. Insights keeps 15 minutes at
  10-second resolution, 24 hours at one minute and 30 days at one hour; above the first
  level its percentiles are [percentiles of
  aggregates]({{ '/docs/insights/' | relative_url }}#percentiles-are-percentiles-of-aggregates).
- **No authentication of its own.** Anyone who can reach `/peekaboot/**` can read
  everything it holds. See [Securing the
  dashboard]({{ '/docs/security/' | relative_url }}#securing-the-dashboard).

## What it costs while it is on

Whenever `peekaboot.enabled` is `true` and the application is a servlet web application:

- `management.tracing.sampling.probability=1.0`, so every request is sampled, for every
  exporter you have configured, not only Peekaboot's store.
- `spring.jpa.properties.[hibernate.generate_statistics]=true`. Hibernate's Micrometer
  meters exist only with statistics on, and the Insights panels sample them.
- A handler span around each controller method and a view-rendering span around each
  rendered view, visible to every exporter.
- An Actuator endpoint that keeps failing is logged once at WARN with the stack trace and
  at DEBUG after that, so a broken endpoint costs one WARN rather than one per refresh.

With the dev toolbar on as well:

- `text/html` responses are buffered so the bar can be injected, up to 2 MB. A larger page
  streams through uninjected.
- Every response carries a `Server-Timing` header with its trace id.
- A Logback appender sees every log event.
- Spans are exported every 200 ms instead of every 5 s.

Memory: the trace store's worst case is `max-traces` &times; (`max-spans-per-trace` +
`max-logs-per-trace`) entries, one million at the defaults. The Insights rings are about
5.2 MB at the defaults, and the exact figure is logged at startup.

## What happens when you deploy

`peekaboot.enabled`, `peekaboot.dev-toolbar` and `peekaboot.storage.enabled` are detected,
not fixed: on for a [local run]({{ '/docs/configuration/' | relative_url }}#local-run), off
everywhere else, and an explicit value wins in either direction. The one deployment that
still reads as local is your build output run directly (`java -cp target/classes:…`) on a
host that is not a container. Set `peekaboot.enabled=false` explicitly there.

With Peekaboot off, exactly one of its *properties* still applies: the OTLP metrics push
stays disabled, because the starter puts that registry on the class path regardless. To
verify the rest is off, look for the startup summary's `Peekaboot Dashboard:` line. It is
absent when the dashboard is not served.

### The class path is a separate question

The starter changes it whether Peekaboot is on or off:

- `/actuator` and `/actuator/health` answer over HTTP. That is Spring Boot's own default
  exposure for `spring-boot-starter-actuator`, not something Peekaboot adds. If the starter
  is how Actuator arrived, it arrived with Peekaboot.
- A `MeterRegistry` exists, with Boot's JVM, system and Logback binders attached.
- The OpenTelemetry SDK and the OTLP exporters are present. Nothing leaves the process:
  metrics are held by the default above, and Boot only builds trace and log exporters once
  you configure an endpoint for them.
- Peekaboot's own jars sit on the class path, unused.

If none of that is acceptable, keep the starter out of the artifact rather than switching
it off. See [keeping it out entirely](#keeping-it-out-of-the-artifact-entirely).

## If you run it somewhere shared

Set `peekaboot.enabled=true` explicitly; the toolbar and disk storage stay off unless you
set them too. Put a `SecurityFilterChain` on `/peekaboot/**` in place first, restrict
network reach as well, and leave `peekaboot.enable-unmasking=false`. Off a local run every
Environment and Config value reads `******`, `server.port` included, unless you set
`management.endpoint.env.show-values` yourself. Masking is not exhaustive: log content and
SQL literals go through unmasked. See [Securing the
dashboard]({{ '/docs/security/' | relative_url }}#securing-the-dashboard) and
[Masking]({{ '/docs/security/' | relative_url }}#masking).

## Tuning what it keeps and costs

| Property | Default | What it decides |
|---|---|---|
| `peekaboot.tracing.enabled` | `true` | Whether the trace store exists |
| `peekaboot.insights.enabled` | `true` | Whether the metric collector and charts exist |
| `peekaboot.lifecycle.enabled` | `true` | The startup and shutdown summaries and the run history |
| `peekaboot.dev-toolbar` | detected | The toolbar, log capture and request-detail capture |
| `peekaboot.storage.enabled` | detected | Whether anything is written to disk |
| `peekaboot.storage.dir` | `${user.home}/.peekaboot/<application id>` | Where those files go |
| `peekaboot.tracing.max-traces` | `1000` | Traces kept before the oldest is evicted |
| `peekaboot.tracing.max-spans-per-trace` | `500` | Spans kept per trace |
| `peekaboot.tracing.max-logs-per-trace` | `500` | Log lines kept per trace, captured only with the toolbar on |
| `peekaboot.tracing.max-error-traces` | `100` | The Errors bucket |
| `peekaboot.tracing.max-slow-traces` | `100` | The Slow bucket |
| `peekaboot.tracing.slow-trace-threshold-ms` | `1000` | What counts as slow for that bucket |
| `peekaboot.insights.levels[n].interval` / `.size` | `10s`&times;90, `1m`&times;1440, `1h`&times;720 | Chart resolution and reach |
| `peekaboot.insights.persistence.interval` / `.max-age` | coarsest level's interval / span | How often the snapshot is written, how old it may be |
| `peekaboot.insights.config-location` | unset | Where the panel overrides are read from |
| `peekaboot.ui.tracing.slow-span-threshold-ms` | `100` | SLOW badge; badges, not capture |
| `peekaboot.ui.tracing.very-slow-span-threshold-ms` | `500` | VERY_SLOW badge |
| `peekaboot.ui.tracing.slow-query-threshold-ms` | `50` | SLOW_QUERY badge |
| `peekaboot.ui.tracing.high-query-count-threshold` | `5` | HIGH_QUERY_COUNT, per span |
| `peekaboot.ui.tracing.high-trace-query-count-threshold` | `20` | HIGH_QUERY_COUNT, per trace |

To undo one of the observability defaults above, set the property in your own
`application.yml`: Peekaboot's defaults sit below everything you configure. See
[Configuration]({{ '/docs/configuration/' | relative_url }}) for every property in full.

## Keeping it out of the artifact entirely

If Peekaboot should never ship at all, exclude it at packaging time instead of relying on
the default being off.

**Maven**, excluded from the repackaged executable jar:

```xml
<plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
    <configuration>
        <excludes>
            <exclude>
                <groupId>org.peekaboot</groupId>
                <artifactId>peekaboot-spring-boot-starter</artifactId>
            </exclude>
        </excludes>
    </configuration>
</plugin>
```

**Gradle**, declared `developmentOnly` instead of `implementation`. Boot's Gradle plugin
keeps it off the production runtime classpath and out of the executable jar, and still
gives it to `bootRun`:

```groovy
developmentOnly("org.peekaboot:peekaboot-spring-boot-starter:{{ site.peekaboot_version }}")
```
