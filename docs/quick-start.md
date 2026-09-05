---
title: Quick start
lead: One dependency, no configuration, the toolbar on your next run.
permalink: /docs/quick-start/
redirect_from:
  - /docs/requirements/
---

## Add the dependency

**Maven**

```xml
<dependency>
    <groupId>org.peekaboot</groupId>
    <artifactId>peekaboot-spring-boot-starter</artifactId>
    <version>{{ site.peekaboot_version }}</version>
</dependency>
```

**Gradle**

```groovy
implementation("org.peekaboot:peekaboot-spring-boot-starter:{{ site.peekaboot_version }}")
```

## What your application needs

- **Java 25 or newer**
- **Spring Boot 4.1.** Built and tested against this version; earlier 4.x releases are
  untested.
- **A servlet web application.** The dashboard is served through Spring MVC.

On WebFlux or a non-web application the dashboard and the dev toolbar don't register, so
there is nothing under `/peekaboot/`. Startup is unaffected and nothing errors. The startup
and shutdown summaries still run, and so does the run history: it is kept in memory, and
written under `~/.peekaboot/` when storage is on, which a [local
run]({{ '/docs/configuration/' | relative_url }}#local-run) turns on by default. The
[defaults Peekaboot would set]({{ '/docs/configuration/' | relative_url }}#what-peekaboot-sets-in-your-application)
for the dashboard's benefit are not applied there either.

## Run your app

Run it the way you already do: from your IDE, `mvn spring-boot:run`, or `gradle bootRun`.
Nothing else to configure. Peekaboot detects that launch as local development and turns
itself and the [dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}) on. Open any page
and it's already there.

<figure class="image">
  <img src="{{ '/assets/img/screenshots/toolbar-collapsed-light.png' | relative_url }}"
       alt="The collapsed dev toolbar docked at the bottom of the page, showing a 200 status badge, GET /orders, the controller method, duration, query count and duration, and a copyable trace id"
       loading="lazy">
</figure>

Request and response detail, the trace view, and logs correlated to the request are one
click away. See [Dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}) for what each part
shows.

<div class="pk-callout" markdown="1">
Set `peekaboot.dev-toolbar: false` to turn the toolbar off and keep the rest of the
dashboard. See [Configuration]({{ '/docs/configuration/' | relative_url }}#local-run) for
exactly what counts as a local run.
</div>

<div class="pk-callout pk-callout--warning" markdown="1">
**Working in a devcontainer?** A container is never a local run, and a devcontainer runs
your application in a container. Nothing turns itself on, and it looks like the starter is
broken. Set `peekaboot.enabled`, `peekaboot.dev-toolbar` and `peekaboot.storage.enabled` to
`true` in the devcontainer's own configuration. See
[Configuration]({{ '/docs/configuration/' | relative_url }}#local-run).
</div>

## Open the dashboard

It sits at [`http://localhost:8080/peekaboot/`](http://localhost:8080/peekaboot/), its API
under [`http://localhost:8080/peekaboot/api/`](http://localhost:8080/peekaboot/api/). If
your application doesn't run on port 8080, you don't have to work the address out. The
summary Peekaboot logs once the application is ready prints the real URL, context path and
all, on a `Peekaboot Dashboard:` line. See
[Configuration]({{ '/docs/configuration/' | relative_url }}#the-urls-in-the-summary).

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-overview-light.png' | relative_url }}"
       alt="The Peekaboot dashboard's Overview tab, showing Build, Git, Spring, Java, System, JVM Defaults and Datasource cards for a running application"
       loading="lazy">
</figure>

## What you get immediately

- The dev toolbar on every page: request and response detail, the trace view, and logs
  correlated to the request
- Overview: build and Git info, Spring Boot and Java versions, system and JVM details, and
  datasource status
- Environment and Config: every property source Spring resolved, and every
  `@ConfigurationProperties` bean's effective values
- Flyway migration history, runtime logger levels, and scheduled task listings
- Every meter in Micrometer's registry on Meters, and the curated ones charted over time on
  [Insights]({{ '/docs/insights/' | relative_url }}). No Prometheus, no scrape endpoint
- Full request traces, spans and SQL queries both, for the last thousand requests your app
  has served, oldest evicted once the cap is full (`peekaboot.tracing.max-traces`; see
  [Traces]({{ '/docs/traces/' | relative_url }}#the-three-buckets))

## What the starter brings

Adding `peekaboot-spring-boot-starter` pulls in exactly four dependencies:

| Dependency | What it's for |
|---|---|
| `org.peekaboot:peekaboot-spring-boot-autoconfigure` | Peekaboot's own auto-configuration, backend services and dashboard frontend |
| `spring-boot-starter` | The base Spring Boot starter |
| `spring-boot-starter-actuator` | The Overview, Env, Loggers, Flyway, Config and Scheduled Tasks endpoints Peekaboot reads in process. Micrometer's `MeterRegistry` comes with it; the Meters and Insights tabs read that bean directly rather than through an endpoint |
| `spring-boot-starter-opentelemetry` | The OpenTelemetry SDK and the Micrometer Tracing bridge that feed the in-memory trace store |

Peekaboot reads spans from the OpenTelemetry SDK only. There is no Micrometer Tracing Brave
(OpenZipkin) bridge: an application wired to Brave instead gets a toolbar that renders but
never resolves a trace, and an empty Traces tab. The starter brings
`spring-boot-starter-opentelemetry` as a hard dependency, so this only arises if you
exclude it.

## Graceful degradation

On a servlet web application, a missing piece degrades rather than failing startup.

| Missing | What happens |
|---|---|
| A Micrometer `Tracer` bean | The dev toolbar doesn't register at all. The rest of the dashboard is unaffected |
| The OpenTelemetry SDK | The trace store is still created and nothing fills it. The Traces tab is empty rather than missing |
| A Micrometer `MeterRegistry` bean | The Meters tab, the Insights tab, the insights API and the Overview stat tiles are absent rather than empty. See [Insights]({{ '/docs/insights/' | relative_url }}#when-the-tab-isnt-there) |

The starter supplies all three, so each of these only comes up if you exclude something.

## Next

- [The dashboard]({{ '/docs/dashboard/' | relative_url }}): a tour of every tab.
- [Configuration]({{ '/docs/configuration/' | relative_url }}): every property, its default,
  and what it controls.
