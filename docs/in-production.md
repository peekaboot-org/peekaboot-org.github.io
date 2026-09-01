---
title: Do I want this in production?
lead: What Peekaboot is built for, what it costs while it is on, and what becomes of it when you deploy.
permalink: /docs/in-production/
---

## What Peekaboot is built for

The ten seconds after you hit a page on your own machine: the toolbar on that page, the
request's trace, its queries and its logs, with no collector, agent or backend to run
first. It is not a smaller Grafana. Past one process you want a real tracing backend
&mdash; see [Tracing vs distributed
tracing]({{ '/docs/tracing/' | relative_url }}#tracing-vs-distributed-tracing) for where
the line falls.

## What you get without any infrastructure

- Every request traced, with the full span tree, the SQL text, the logs it produced and
  the application's restart history &mdash; in memory, inside your own process.
- Actuator's data read in-process. Peekaboot needs no
  `management.endpoints.web.exposure` change, and nothing on `/actuator/**` changes: what
  your application exposes there, and what those endpoints answer, is the same with or
  without Peekaboot. <!-- verify: show-details default removed -->
- Micrometer's OTLP metrics push switched off, so telemetry never leaves the process by
  accident.
- Additive: your own OTLP or Zipkin exporters and your sampling configuration keep
  working; Peekaboot's store is one more destination for the same spans.

One exception, confined to a [local run]({{ '/docs/configuration/' | relative_url }}#local-run):
there Peekaboot sets `management.endpoint.env.show-values` and
`.configprops.show-values` to `always`, which also widens your own `/actuator/env` and
`/actuator/configprops` if you expose them over HTTP yourself &mdash; see
[Security]({{ '/docs/security/' | relative_url }}#show-values-always-only-on-a-local-run).

## What it cannot do

- **One process only.** No joining a request across services, no aggregation across
  instances, no alerting.
- **Short retention.** 1000 traces or 30 minutes, whichever comes first. The Insights
  charts keep 15 minutes at 10-second resolution, 24 hours at one minute and 30 days at
  one hour &mdash; and above the first level their percentiles are [percentiles of
  averages]({{ '/docs/insights/' | relative_url }}#percentiles-are-percentiles-of-aggregates).
- **No authentication of its own.** Anyone who can reach `/peekaboot/**` can read
  everything it holds &mdash; see [Securing the
  dashboard]({{ '/docs/security/' | relative_url }}#securing-the-dashboard).

### What it costs while it is on

Whenever `peekaboot.enabled` is `true`:

- `management.tracing.sampling.probability=1.0` &mdash; every request is sampled, for
  every exporter you have configured, not only Peekaboot's store.
- `spring.jpa.properties.[hibernate.generate_statistics]=true` &mdash; Hibernate keeps
  statistics, which the `hibernate.*` meter panels need.
- A handler span around each controller method and a view-rendering span around each
  rendered view, visible to every exporter.

With the dev toolbar on as well:

- HTML responses are buffered so the bar can be injected.
- Every response carries a `Server-Timing` header with its trace id.
- A Logback appender sees every log event.
- Spans are exported every 200 ms instead of every 5 s.

Memory: the trace store's worst case is `max-traces` &times; (`max-spans-per-trace` +
`max-logs-per-trace`) entries &mdash; one million at the defaults; the Insights rings are
about 4.5 MB at the defaults, and the exact figure is logged at startup.

## What happens when you deploy

`peekaboot.enabled`, `peekaboot.dev-toolbar` and `peekaboot.storage.enabled` are detected,
not fixed: on for a local run, off everywhere else. A `java -jar` of the packaged jar, a
war, a native image, an AOT run, a test, and anything running in a container resolve to
`false`. The one deployment that still reads as local is a host that is not a container
running your build output directly (`java -cp target/classes:…`); set
`peekaboot.enabled=false` explicitly there. Any explicit value wins over the detection.

With Peekaboot off, exactly one of its defaults still applies: the OTLP metrics push stays
disabled, because the starter puts that registry on the classpath regardless. To verify
the rest is off, look for the startup summary's `Peekaboot Dashboard:` line &mdash; it is
absent when the dashboard is not served.

## If you decide to run it somewhere shared

- Set `peekaboot.enabled=true` explicitly. The toolbar and disk storage stay off unless
  you set them too.
- Put a `SecurityFilterChain` on `/peekaboot/**` in place first, and restrict network reach
  as well &mdash; see [Security]({{ '/docs/security/' | relative_url }}#securing-the-dashboard).
- Leave `peekaboot.enable-unmasking=false`.
- Off a local run every Environment and Config value shows as `******` unless you set
  `management.endpoint.env.show-values` yourself.
- Log content, SQL literals and anything without a recognisable secret shape are not
  masked &mdash; see [Masking]({{ '/docs/security/' | relative_url }}#masking).

## Tuning what it keeps and costs

| Property | Default | What it decides |
|---|---|---|
| `peekaboot.tracing.enabled` | `true` | Whether the trace store exists |
| `peekaboot.insights.enabled` | `true` | Whether the metric collector and charts exist |
| `peekaboot.lifecycle.enabled` | `true` | The startup and shutdown summaries and the run history |
| `peekaboot.dev-toolbar` | detected | The toolbar, log capture and request-detail capture |
| `peekaboot.storage.enabled` | detected | Whether anything is written to disk |
| `peekaboot.storage.dir` | `${user.home}/.peekaboot/<groupId>.<artifactId>` | Where those files go |
| `peekaboot.tracing.max-traces` | `1000` | Traces kept; the 30-minute time-to-live is fixed |
| `peekaboot.tracing.max-spans-per-trace` | `500` | Spans kept per trace |
| `peekaboot.tracing.max-logs-per-trace` | `500` | Log lines kept per trace |
| `peekaboot.tracing.max-error-traces` | `100` | The Errors bucket |
| `peekaboot.tracing.max-slow-traces` | `100` | The Slow bucket |
| `peekaboot.tracing.slow-trace-threshold-ms` | `1000` | What counts as slow for that bucket |
| `peekaboot.insights.levels[n].interval` / `.size` | `10s`&times;90, `1m`&times;1440, `1h`&times;720 | Chart resolution and reach |
| `peekaboot.insights.persistence.interval` / `.max-age` | coarsest level's interval / span | How often the snapshot is written, how old it may be |
| `peekaboot.insights.config-location` | unset | Where the panel file lives |
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

**Maven** &mdash; exclude it from the repackaged executable jar:

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

**Gradle** &mdash; declare it `developmentOnly` instead of `implementation`; the Spring Boot
Gradle plugin keeps it off the production runtime classpath and out of the executable jar
while still providing it to `bootRun`:

```groovy
developmentOnly("org.peekaboot:peekaboot-spring-boot-starter:{{ site.peekaboot_version }}")
```
