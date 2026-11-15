---
title: Do I want this in production?
lead: What Peekaboot changes while it is on, what it costs, and how to keep it out of a production build.
permalink: /docs/in-production/
---

Peekaboot is built for one process on your own machine: the toolbar, the request's trace, its
queries and its logs, with no collector or backend to run. [Traces,
limitations]({{ '/docs/traces/' | relative_url }}#tracing-vs-distributed-tracing) says what that
leaves to a tracing backend.

On a deployment Peekaboot is off unless you set `peekaboot.enabled=true`. Turned on there, it
serves the dashboard and API behind its guard and leaves the toolbar, storage and the error
page off.

## What happens on a deployment {#what-happens-on-a-deployment}

<span id="what-happens-when-you-deploy"></span>A deployment is every launch that is neither a
local run nor a test, such as `java -jar`, a war, a native image or anything in a container.
[Configuration, what counts as a local
run]({{ '/docs/configuration/' | relative_url }}#local-run) has the rules.

| Part | With Peekaboot off, the default | With `peekaboot.enabled=true` |
|---|---|---|
| Dashboard and API | Not served | Served |
| Peekaboot's guard | Nothing to guard | Armed. HTTP Basic, with the generated password in the startup log. |
| Dev toolbar | Off | Off until you set `peekaboot.dev-toolbar.enabled=true` |
| Error page | Off | Off until you set `peekaboot.error-page.enabled=true` |
| Files on disk | None | None until you set `peekaboot.storage.enabled=true` or `peekaboot.security.credentials-file` |
| Tracing and Insights | Off | On, in memory only |
| Startup and shutdown summaries | None | Logged |
| Spring Boot defaults | `management.otlp.metrics.export.enabled=false` and `jdbc.datasource-proxy.enabled=false` | `management.otlp.metrics.export.enabled=false`, and the sampling, Hibernate and observation defaults under [Configuration, Spring Boot defaults Peekaboot changes]({{ '/docs/configuration/' | relative_url }}#what-peekaboot-sets-in-your-application) |

[Configuration, when Peekaboot is
on]({{ '/docs/configuration/' | relative_url }}#when-peekaboot-is-on) lists each switch and its
default.

One launch you might deploy also counts as local. See [what counts as a local
run]({{ '/docs/configuration/' | relative_url }}#local-run).

A launch that counts as local answers only the machine it runs on. A build-tool launch on a
server is not readable from the network unless `peekaboot.remote-access.enabled=true` opens it.
See [Security, who can reach
Peekaboot]({{ '/docs/security/' | relative_url }}#who-can-reach-peekaboot).

With lifecycle summaries on (the default), the startup summary has a `Peekaboot Dashboard:`
line only while the dashboard is served.

## Before you turn it on {#before-you-turn-it-on}

<span id="if-you-run-it-somewhere-shared"></span>Work through this list before
`peekaboot.enabled=true` reaches a deployment or a machine other people use.

1. Verify `peekaboot.enabled` resolves to `false` wherever you do not want the dashboard.
   The startup summary has no `Peekaboot Dashboard:` line when the dashboard is off.
1. Set `peekaboot.enabled=false` explicitly if you deploy with a launch that [counts as
   local]({{ '/docs/configuration/' | relative_url }}#local-run).
1. If Peekaboot must never ship, keep the starter out of the production artifact. See [Keeping
   it out of the artifact entirely](#keeping-it-out-of-the-artifact-entirely).
1. Where you turn it on, set `peekaboot.tracing.enabled=false` unless you need traces with
   their headers, parameters and logs. On a deployment the toolbar, storage and the error
   page stay off unless you set them.
1. Decide on the Spring Boot defaults Peekaboot changes while it is on.
   `peekaboot.tracing.enabled=false` leaves them in place: every request is still sampled,
   Hibernate statistics stay on and observation annotations still record. Set
   `management.tracing.sampling.probability`,
   `spring.jpa.properties[hibernate.generate_statistics]` and
   `management.observations.annotations.enabled` yourself where you want Spring Boot's
   values. See [Configuration, Spring Boot defaults Peekaboot
   changes]({{ '/docs/configuration/' | relative_url }}#what-peekaboot-sets-in-your-application).
1. Protect `/peekaboot/**`. Keep Peekaboot's guard with a stable password, see [Security,
   Peekaboot's guard]({{ '/docs/security/' | relative_url }}#peekaboots-guard), or set
   `peekaboot.security.enabled=false` and put the
   [`SecurityFilterChain`]({{ '/docs/security/' | relative_url }}#securing-the-dashboard) in
   front first. Use the chain if you need roles. Whoever passes reads everything under
   [Security, what the dashboard and API
   show]({{ '/docs/security/' | relative_url }}#what-the-dashboard-and-api-expose).
1. Restrict network reach as well, with an internal-only ingress, a VPN, or a proxy that
   forwards `/peekaboot/**` only from trusted sources.
1. Don't rely on `management.endpoints.web.exposure`. It does not affect `/peekaboot/**`.
1. Leave `peekaboot.unmasking.enabled=false`. With it on, anyone who can reach
   `/peekaboot/**` can add `?unmask=true`.
1. Don't treat masking as complete. Log messages, SQL and request data are masked only
   where a rule recognises them. Don't point Peekaboot at traffic whose secrets must not be
   recorded and displayed.

## What it changes while it is on {#what-it-costs-while-it-is-on}

Everything Peekaboot sets sits below your own configuration, so a value you set wins.
[Configuration, Spring Boot defaults Peekaboot
changes]({{ '/docs/configuration/' | relative_url }}#what-peekaboot-sets-in-your-application)
lists the properties it changes and what each one costs.

In short, every request is sampled, Hibernate statistics are on, `@Observed`, `@Timed` and
`@Counted` record, and with the toolbar on spans are exported every 200 ms.
`peekaboot.tracing.enabled=false` changes none of these.

Peekaboot also adds these:

| Change | Effect | Applied when |
|---|---|---|
| Handler and view spans | A span around each controller method and each rendered view, sent to every exporter | `peekaboot.enabled`, `peekaboot.tracing.enabled` |
| Async task spans | A span around each task a Spring task executor runs inside a trace, sent to every exporter. Turn off with `peekaboot.tracing.async=false`. | `peekaboot.enabled`, `peekaboot.tracing.enabled` |
| Event listener spans | A span around each `@EventListener` call inside a trace, sent to every exporter. Listener beans become proxies. Turn off with `peekaboot.tracing.event-listeners=false`. | `peekaboot.enabled`, `peekaboot.tracing.enabled` |
| HTML response buffering | `text/html` responses are buffered up to 2 MiB so the toolbar can be injected. Larger pages stream through without it. | Dev toolbar on |
| `Server-Timing` header | Every response carries its trace id, except on the [paths Peekaboot never records]({{ '/docs/traces/' | relative_url }}#what-gets-captured) | `peekaboot.enabled`, `peekaboot.tracing.enabled` |
| Log capture | A Logback appender receives every log event | `peekaboot.enabled`, `peekaboot.tracing.enabled` |

An Actuator endpoint that keeps failing is logged once at WARN with its stack trace, then at
DEBUG. Peekaboot adds no `/actuator` exposure. See [Security, Peekaboot leaves `/actuator`
alone]({{ '/docs/security/' | relative_url }}#what-peekaboot-does-not-do) and [Configuration,
Spring Boot defaults Peekaboot
changes]({{ '/docs/configuration/' | relative_url }}#what-peekaboot-sets-in-your-application).

## Memory {#memory}

{% include facts/trace-memory.md -%}
[Traces, buckets, limits and memory]({{ '/docs/traces/' | relative_url }}#the-three-buckets)
describes the buckets and the limits.

The Insights history is sized by `peekaboot.insights.levels` and by how many series the
enabled panels produce.
{% include facts/insights-memory.md -%}
Peekaboot logs the estimate at startup. See [Insights, what it
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

## The starter is on the classpath even when Peekaboot is off {#class-path}

With `peekaboot.enabled=false` the starter still brings:

- `spring-boot-starter-actuator`. Spring Boot's default exposure serves `/actuator` and
  `/actuator/health` over HTTP. An application that had no Actuator gains both.
- A `MeterRegistry` with Spring Boot's JVM, system and Logback meters.
- The OpenTelemetry SDK and OTLP exporters. Nothing is sent. Metrics export is off, see
  [Configuration]({{ '/docs/configuration/' | relative_url }}#what-peekaboot-sets-in-your-application),
  and Spring Boot creates trace and log exporters only once you configure an endpoint.
- `datasource-micrometer`, with `spring-boot-jdbc`, `spring-jdbc`, `datasource-proxy` and
  JSqlParser. While Peekaboot is off it sets `jdbc.datasource-proxy.enabled=false`, so none of
  your DataSources is wrapped. Set it to `true` if you use datasource-micrometer yourself.
- Peekaboot's own jars, unused.

If that is not acceptable, keep the starter out of the artifact.

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
