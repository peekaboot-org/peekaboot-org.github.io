---
title: Do I want this in production?
lead: What Peekaboot changes while it is on, what it costs, and how to keep it out of a production build.
permalink: /docs/in-production/
---

Peekaboot is built for one process on your own machine: the toolbar, the request's trace, its
queries and its logs, with no collector or backend to run. For anything across services or
instances, use a tracing backend. [Traces,
limitations]({{ '/docs/traces/' | relative_url }}#tracing-vs-distributed-tracing) has the
details.

## When it is active {#what-happens-when-you-deploy}

Peekaboot is on for a [local run]({{ '/docs/configuration/' | relative_url }}#local-run) (IDE,
`spring-boot:run`, `bootRun`) and off for `java -jar`, wars, native images, containers and
tests. `peekaboot.dev-toolbar`, `peekaboot.storage.enabled`, `peekaboot.error-page.enabled` and
`peekaboot.stack-trace.fold` follow the same rule. `peekaboot.security.enabled` is the reverse:
on for a deployment launch, off for local runs and tests. An explicit value always wins.

Running your build output directly on a host that is not a container
(`java -cp target/classes …`) counts as a local run. Set `peekaboot.enabled=false` there.

With lifecycle summaries on (the default), the startup summary has a `Peekaboot Dashboard:`
line only while the dashboard is served.

## What it changes while it is on {#what-it-costs-while-it-is-on}

Everything Peekaboot sets sits below your own configuration, so a value you set wins.

| Change | Value | Applied when |
|---|---|---|
| `management.otlp.metrics.export.enabled` | `false` | Always, even with Peekaboot off |
| `management.tracing.sampling.probability` | `1.0`: every request is sampled, for every exporter you have | `peekaboot.enabled`, servlet application |
| `spring.jpa.properties.[hibernate.generate_statistics]` | `true`: Hibernate collects statistics | `peekaboot.enabled`, servlet application |
| `management.info.env`, `.java`, `.os`, `.process.enabled` | `true`: `/actuator/info` carries that content if you expose it | `peekaboot.enabled`, servlet application |
| `management.observations.annotations.enabled` | `true`: `@Observed`, `@Timed` and `@Counted` take effect | `peekaboot.enabled`, servlet application |
| Handler and view spans | A span around each controller method and each rendered view, sent to every exporter | `peekaboot.enabled`, `peekaboot.tracing.enabled` |
| Async task spans | A span around each task a Spring task executor runs inside a trace, sent to every exporter. Turn off with `peekaboot.tracing.async=false`. | `peekaboot.enabled`, `peekaboot.tracing.enabled` |
| `management.opentelemetry.tracing.export.schedule-delay` | `200ms` instead of `5s`: spans reach every exporter about 25 times as often | Dev toolbar on |
| HTML response buffering | `text/html` responses are buffered up to 2 MiB so the toolbar can be injected. Larger pages stream through without it. | Dev toolbar on |
| `Server-Timing` header | Every response carries its trace id | Dev toolbar on |
| Log capture | A Logback appender receives every log event | Dev toolbar on |

An Actuator endpoint that keeps failing is logged once at WARN with its stack trace, then at
DEBUG. Peekaboot adds no `/actuator` exposure. See [Security, Peekaboot leaves `/actuator`
alone]({{ '/docs/security/' | relative_url }}#what-peekaboot-does-not-do) and [Configuration,
Spring Boot defaults Peekaboot
changes]({{ '/docs/configuration/' | relative_url }}#what-peekaboot-sets-in-your-application).

## Memory {#memory}

The trace store holds up to `max-traces` + `max-error-traces` + `max-slow-traces` traces
(1,000 + 100 + 100 at the defaults), each capped at `max-spans-per-trace` +
`max-logs-per-trace` entries (500 + 500). The worst case is about 1.2 million entries.

The Insights history is sized by `peekaboot.insights.levels` and by how many series the
enabled panels produce. Peekaboot logs the estimate at startup. See [Insights, what it
costs]({{ '/docs/insights/' | relative_url }}#what-it-costs).

To size either down, see [Configuration, memory-constrained]({{ '/docs/configuration/' | relative_url }}#memory-constrained).

## What it cannot do {#what-it-cannot-do}

- **One process only.** It does not join a request across services, aggregate across
  instances or alert.
- **Short retention.** The trace list keeps the latest 1,000 traces. Insights keeps 30 days
  at its default [levels]({{ '/docs/insights/' | relative_url }}#levels), and above the first
  level its percentiles are [percentiles of
  aggregates]({{ '/docs/insights/' | relative_url }}#percentiles-of-aggregates).
- **Minimal access control.** Outside local development its fallback guard is HTTP Basic with
  one credential. It stands down for any request your own Spring Security chain has already
  authenticated. See [Security, if nothing else secures
  it]({{ '/docs/security/' | relative_url }}#if-nothing-else-secures-it).

## The starter is on the class path even when Peekaboot is off {#class-path}

With `peekaboot.enabled=false` the starter still brings:

- `spring-boot-starter-actuator`. Spring Boot's default exposure serves `/actuator` and
  `/actuator/health` over HTTP.
- A `MeterRegistry` with Spring Boot's JVM, system and Logback meters.
- The OpenTelemetry SDK and OTLP exporters. Nothing is sent: metrics export is off (see the
  table above), and Spring Boot creates trace and log exporters only once you configure an
  endpoint.
- Peekaboot's own jars, unused.

If that is not acceptable, keep the starter out of the artifact.

## Running it on a shared server {#if-you-run-it-somewhere-shared}

Follow [Security, running it on a shared or deployed
server]({{ '/docs/security/' | relative_url }}#running-it-in-a-deployed-environment).

## Keeping it out of the artifact entirely {#keeping-it-out-of-the-artifact-entirely}

**Maven.** Declare the starter in a profile that is active unless you build with
`-Dproduction`:

```xml
<profiles>
    <profile>
        <id>peekaboot</id>
        <activation>
            <property>
                <name>!production</name>
            </property>
        </activation>
        <dependencies>
            <dependency>
                <groupId>{{ site.maven_group }}</groupId>
                <artifactId>{{ site.maven_artifact }}</artifactId>
                <version>{{ site.peekaboot_version }}</version>
            </dependency>
        </dependencies>
    </profile>
</profiles>
```

Build the production artifact with `mvn package -Dproduction`. Your IDE and `spring-boot:run`
keep the starter.

Don't use the Spring Boot Maven plugin's `<excludes>` for this. It removes only the starter
jar, and Peekaboot's auto-configuration jars still ship in the executable jar.

**Gradle.** Declare the starter `developmentOnly` instead of `implementation`. `bootRun` gets
it, and the executable jar does not:

```groovy
developmentOnly("{{ site.maven_group }}:{{ site.maven_artifact }}:{{ site.peekaboot_version }}")
```
