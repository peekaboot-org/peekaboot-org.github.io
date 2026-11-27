---
title: Production use
lead: What Peekaboot changes while it is on, what it costs, and how to keep it out of a production build.
permalink: /docs/in-production/
---

Peekaboot is built for one process on your own machine, with no collector or backend to run.
[Traces, limitations]({{ '/docs/traces/' | relative_url }}#tracing-vs-distributed-tracing) says what that
leaves to a tracing backend.

## What happens on a deployment {#what-happens-on-a-deployment}

<span id="what-happens-when-you-deploy"></span>A deployment is every launch that is neither a
local run nor a test, such as `java -jar`, a war, a native image or anything in a container.
[Configuration, when Peekaboot is
on]({{ '/docs/configuration/' | relative_url }}#when-peekaboot-is-on) has the rules and every
switch.

| Part | With Peekaboot off, the default | With `peekaboot.enabled=true` |
|---|---|---|
| Dashboard and API | Not served | Served |
| Peekaboot's guard | Nothing to guard | Armed. HTTP Basic, with the generated password in the startup log. |
| Dev toolbar | Off | Off until you set `peekaboot.dev-toolbar.enabled=true` |
| Error page | Off | Off until you set `peekaboot.error-page.enabled=true` |
| Files on disk | None | None until you set `peekaboot.storage.enabled=true` or `peekaboot.security.credentials-file` |
| Tracing and Insights | Off | On, in memory only |
| Startup and shutdown summaries | None | Logged |

A [local run]({{ '/docs/configuration/' | relative_url }}#local-run) answers only the machine
it runs on, even on a server, unless `peekaboot.remote-access.enabled=true` opens it. See
[Security, who can reach Peekaboot]({{ '/docs/security/' | relative_url }}#who-can-reach-peekaboot).

## Before you turn it on {#before-you-turn-it-on}

<span id="if-you-run-it-somewhere-shared"></span>Before `peekaboot.enabled=true` reaches a
deployment or a machine other people use:

1. Verify `peekaboot.enabled` resolves to `false` wherever you do not want the dashboard. The
   startup summary has no `Peekaboot Dashboard:` line when it is off.
1. Set `peekaboot.enabled=false` explicitly if you deploy with a launch that [counts as
   local]({{ '/docs/configuration/' | relative_url }}#local-run).
1. If Peekaboot must never ship, keep the starter out of the production artifact. See [Keeping
   it out of the artifact entirely](#keeping-it-out-of-the-artifact-entirely).
1. Where you turn it on, set `peekaboot.tracing.enabled=false` unless you need traces with
   their headers, parameters and logs.
1. Decide on the [Spring Boot defaults Peekaboot
   changes]({{ '/docs/configuration/' | relative_url }}#what-peekaboot-sets-in-your-application)
   while it is on. Set `management.tracing.sampling.probability`,
   `spring.jpa.properties[hibernate.generate_statistics]` and
   `management.observations.annotations.enabled` yourself where you want Spring Boot's values.
1. Protect `/peekaboot/**`. Keep Peekaboot's guard with a stable password, see [Security,
   Peekaboot's guard]({{ '/docs/security/' | relative_url }}#peekaboots-guard), or set
   `peekaboot.security.enabled=false` and put a
   [`SecurityFilterChain`]({{ '/docs/security/' | relative_url }}#securing-the-dashboard) in
   front first. Whoever passes reads everything under [Security, what the dashboard and API
   show]({{ '/docs/security/' | relative_url }}#what-the-dashboard-and-api-expose).
1. Restrict network reach as well, with an internal-only ingress, a VPN, or a proxy that
   forwards `/peekaboot/**` only from trusted sources.
1. Don't rely on `management.endpoints.web.exposure`. It does not affect `/peekaboot/**`.
1. Leave `peekaboot.unmasking.enabled=false`. With it on, anyone who can reach
   `/peekaboot/**` can add `?unmask=true`.
1. Don't treat masking as complete. Log messages, SQL and request data are masked only
   where a rule recognises them.

## What it changes while it is on {#what-it-costs-while-it-is-on}

Peekaboot changes a few Spring Boot defaults: every request is sampled, Hibernate statistics
are on, `@Observed`, `@Timed` and `@Counted` record, and with the toolbar on spans are exported
every 200 ms. A value you set wins. [Configuration, Spring Boot defaults Peekaboot
changes]({{ '/docs/configuration/' | relative_url }}#what-peekaboot-sets-in-your-application)
lists them and what each costs. `peekaboot.tracing.enabled=false` changes none of them.

It also adds these while `peekaboot.enabled` and `peekaboot.tracing.enabled` are true:

| Change | Effect |
|---|---|
| Handler and view spans | A span around each controller method and each rendered view, sent to every exporter |
| Async task spans | A span around each task a Spring task executor runs inside a trace, sent to every exporter. Turn off with `peekaboot.tracing.async=false`. |
| Event listener spans | A span around each `@EventListener` call inside a trace, sent to every exporter. Listener beans become proxies. Turn off with `peekaboot.tracing.event-listeners=false`. |
| HTML response buffering | With the dev toolbar on, `text/html` responses are buffered up to 2 MiB so the toolbar can be injected. Larger pages stream through without it. |
| `Server-Timing` header | Every response carries its trace id |
| Log capture | Every log event is captured |

Peekaboot adds no `/actuator` exposure. See [Security, Peekaboot leaves `/actuator`
alone]({{ '/docs/security/' | relative_url }}#what-peekaboot-does-not-do).

## Uptime monitors {#uptime-monitors}

Point a monitor at `/peekaboot/api/health` with an `Authorization: Basic ...` header made from
Peekaboot's credentials. It answers `503` when the application is down, and its body names the
failing component and its target. A monitor with no credentials keeps using `/actuator/health`.
Set its timeout above your slowest health check, see [API,
health]({{ '/docs/api/' | relative_url }}#health).

## Memory {#memory}

{% include facts/trace-memory.md -%}
See [Traces, buckets, limits and
memory]({{ '/docs/traces/' | relative_url }}#the-three-buckets).

The Insights history is sized by `peekaboot.insights.levels` and by how many series the
enabled panels produce.
{% include facts/insights-memory.md -%}
Peekaboot logs the estimate at startup. See [Insights, what it
costs]({{ '/docs/insights/' | relative_url }}#what-it-costs).

To size either down, see [Configuration, memory-constrained]({{ '/docs/configuration/' | relative_url }}#memory-constrained).

## What it cannot do {#what-it-cannot-do}

- **One process, short history.** See [Traces,
  limitations]({{ '/docs/traces/' | relative_url }}#tracing-vs-distributed-tracing).
- **Minimal access control.** On a deployment its guard is HTTP Basic with one credential and
  no throttle on failed attempts. See [Security, Peekaboot's guard]({{ '/docs/security/' | relative_url }}#peekaboots-guard).

## The starter is on the classpath even when Peekaboot is off {#class-path}

Adding the starter pulls in `spring-boot-starter`, `spring-boot-starter-actuator`,
`spring-boot-starter-opentelemetry`, `datasource-micrometer-spring-boot` and
`datasource-micrometer-opentelemetry`, which capture your JDBC queries. With
`peekaboot.enabled=false` that means:

- Spring Boot's default exposure serves `/actuator` and `/actuator/health` over HTTP. An
  application that had no Actuator gains both.
- A `MeterRegistry` exists, with Spring Boot's JVM, system and Logback meters.
- OpenTelemetry tracing is present. Nothing is sent until you configure an exporter endpoint.
- datasource-micrometer is present. Peekaboot sets `jdbc.datasource-proxy.enabled=false`, so
  none of your DataSources is wrapped. Set it to `true` if you use datasource-micrometer
  yourself.
- JSqlParser 5.3 is on your classpath, brought by `datasource-micrometer-opentelemetry`. See
  [JSqlParser on your classpath](#jsqlparser).

Peekaboot requires the OpenTelemetry bridge the starter brings. Brave is not supported: with the
Brave bridge the Traces tab stays empty and the toolbar never shows a trace.

If that is not acceptable, keep the starter out of the artifact.

### JSqlParser on your classpath {#jsqlparser}

JSqlParser has two effects, both with `peekaboot.enabled=false`.

**JaCoCo prints a stack trace.** On the first test run the JaCoCo agent prints a
`MethodTooLargeException` for `CCJSqlParserTokenManager`, about 230 lines long. Exclude
JSqlParser from instrumentation.

Maven:

```xml
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <configuration>
        <excludes>
            <exclude>net.sf.jsqlparser.*</exclude>
        </excludes>
    </configuration>
</plugin>
```

Gradle (Kotlin DSL):

```kotlin
tasks.withType<Test>().configureEach {
    extensions.configure(JacocoTaskExtension::class) {
        excludes = listOf("net.sf.jsqlparser.*")
    }
}
```

**Spring Data JPA uses it.** Spring Data JPA logs `JSqlParser is in classpath; If applicable,
JSqlParser will be used`. According to its reference documentation, it then uses JSqlParser for
native queries, including deriving the count query of a paged one. Its built-in parser handles
only simple queries. The documentation names no property to choose the parser.

**Removing it.** To drop JSqlParser, exclude it from the starter and turn off the SQL analysis of
datasource-micrometer. The analysis needs JSqlParser, so never exclude one without the other.

```xml
<dependency>
    <groupId>org.peekaboot</groupId>
    <artifactId>peekaboot-spring-boot-starter</artifactId>
    <exclusions>
        <exclusion>
            <groupId>com.github.jsqlparser</groupId>
            <artifactId>jsqlparser</artifactId>
        </exclusion>
    </exclusions>
</dependency>
```

```properties
jdbc.opentelemetry.analysis.enabled=false
```

Exported JDBC query spans then lose their query summary, operation name and collection name.
Native queries in Spring Data JPA go through its built-in parser. Declare
`@Query(countQuery = ...)` on paged native queries that are not simple.

### If you exclude one of them {#graceful-degradation}

Startup never fails because of a missing piece.

| Missing | What happens |
|---|---|
| A Micrometer `Tracer` bean | The dev toolbar is absent. The rest of the dashboard works. |
| The OpenTelemetry SDK | The Traces tab explains that the SDK is missing. |
| A Micrometer `MeterRegistry` bean | The Meters and Insights tabs, the insights API and the Overview stat tiles are absent. See [Insights]({{ '/docs/insights/' | relative_url }}#when-the-tab-appears). |

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

Don't use the Spring Boot Maven plugin's `<excludes>`. It leaves Peekaboot jars in the
executable jar. Use the profile instead.

**Gradle.** Declare the starter `developmentOnly` instead of `implementation`. `bootRun` gets
it, and the executable jar does not:

```groovy
developmentOnly("{{ site.maven_group }}:{{ site.maven_artifact }}:{{ site.peekaboot_version }}")
```
