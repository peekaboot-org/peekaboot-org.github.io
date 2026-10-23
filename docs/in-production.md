---
title: Do I want this in production?
lead: What Peekaboot changes while it is on, what it costs, and how to keep it out of a production build.
permalink: /docs/in-production/
---

Peekaboot is built for one process on your own machine: the toolbar, the request's trace, its
queries and its logs, with no collector or backend to run. [Traces,
limitations]({{ '/docs/traces/' | relative_url }}#tracing-vs-distributed-tracing) says what that
leaves to a tracing backend.

## When it is active {#what-happens-when-you-deploy}

Peekaboot is on for a [local run]({{ '/docs/configuration/' | relative_url }}#local-run) and
off for a deployment or a test. [Configuration, when Peekaboot is
on]({{ '/docs/configuration/' | relative_url }}#when-peekaboot-is-on) lists each switch and its
default.

One launch you might deploy also counts as local. See [what counts as a local
run]({{ '/docs/configuration/' | relative_url }}#local-run).

With lifecycle summaries on (the default), the startup summary has a `Peekaboot Dashboard:`
line only while the dashboard is served.

## What it changes while it is on {#what-it-costs-while-it-is-on}

Everything Peekaboot sets sits below your own configuration, so a value you set wins.
[Configuration, Spring Boot defaults Peekaboot
changes]({{ '/docs/configuration/' | relative_url }}#what-peekaboot-sets-in-your-application)
lists the properties it changes and what each one costs. It also adds these:

| Change | Effect | Applied when |
|---|---|---|
| Handler and view spans | A span around each controller method and each rendered view, sent to every exporter | `peekaboot.enabled`, `peekaboot.tracing.enabled` |
| Async task spans | A span around each task a Spring task executor runs inside a trace, sent to every exporter. Turn off with `peekaboot.tracing.async=false`. | `peekaboot.enabled`, `peekaboot.tracing.enabled` |
| Event listener spans | A span around each `@EventListener` call inside a trace, sent to every exporter. Listener beans become proxies. Turn off with `peekaboot.tracing.event-listeners=false`. | `peekaboot.enabled`, `peekaboot.tracing.enabled` |
| HTML response buffering | `text/html` responses are buffered up to 2 MiB so the toolbar can be injected. Larger pages stream through without it. | Dev toolbar on |
| `Server-Timing` header | Every response carries its trace id, except on the [paths Peekaboot never records]({{ '/docs/traces/' | relative_url }}#what-gets-captured) | Dev toolbar on |
| Log capture | A Logback appender receives every log event | Dev toolbar on |

An Actuator endpoint that keeps failing is logged once at WARN with its stack trace, then at
DEBUG. Peekaboot adds no `/actuator` exposure. See [Security, Peekaboot leaves `/actuator`
alone]({{ '/docs/security/' | relative_url }}#what-peekaboot-does-not-do) and [Configuration,
Spring Boot defaults Peekaboot
changes]({{ '/docs/configuration/' | relative_url }}#what-peekaboot-sets-in-your-application).

## Memory {#memory}

The trace store is capped by trace count and by spans and log lines per trace. [Traces,
buckets, limits and memory]({{ '/docs/traces/' | relative_url }}#the-three-buckets) works out
the worst case.

The Insights history is sized by `peekaboot.insights.levels` and by how many series the
enabled panels produce. Peekaboot logs the estimate at startup. See [Insights, what it
costs]({{ '/docs/insights/' | relative_url }}#what-it-costs).

To size either down, see [Configuration, memory-constrained]({{ '/docs/configuration/' | relative_url }}#memory-constrained).

## What it cannot do {#what-it-cannot-do}

- **One process, short history.** See [Traces,
  limitations]({{ '/docs/traces/' | relative_url }}#tracing-vs-distributed-tracing).
- **Minimal access control.** On a deployment its guard is HTTP Basic with one credential. It
  challenges every request, whatever else signed the reader in. Switch it off only once your
  own security requires a login on `/peekaboot/**`. Otherwise the dashboard is open to anyone
  who reaches it. See [Security, Peekaboot's
  guard]({{ '/docs/security/' | relative_url }}#peekaboots-guard).

## The starter is on the class path even when Peekaboot is off {#class-path}

With `peekaboot.enabled=false` the starter still brings:

- `spring-boot-starter-actuator`. Spring Boot's default exposure serves `/actuator` and
  `/actuator/health` over HTTP.
- A `MeterRegistry` with Spring Boot's JVM, system and Logback meters.
- The OpenTelemetry SDK and OTLP exporters. Nothing is sent. Metrics export is off, see
  [Configuration]({{ '/docs/configuration/' | relative_url }}#what-peekaboot-sets-in-your-application),
  and Spring Boot creates trace and log exporters only once you configure an endpoint.
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
