---
title: Quick start
lead: Add the starter, run your app, open the toolbar and the dashboard.
permalink: /docs/quick-start/
redirect_from:
  - /docs/requirements/
---

## Add the dependency {#add-the-dependency}

**Maven**

```xml
<dependency>
    <groupId>{{ site.maven_group }}</groupId>
    <artifactId>{{ site.maven_artifact }}</artifactId>
    <version>{{ site.peekaboot_version }}</version>
</dependency>
```

**Gradle**

```groovy
implementation("{{ site.maven_group }}:{{ site.maven_artifact }}:{{ site.peekaboot_version }}")
```

To keep Peekaboot out of the executable jar in Gradle, declare it `developmentOnly` instead.
Spring Boot's Gradle plugin still puts it on the `bootRun` class path:

```groovy
developmentOnly("{{ site.maven_group }}:{{ site.maven_artifact }}:{{ site.peekaboot_version }}")
```

For Maven, see [Keeping it out of the
artifact]({{ '/docs/in-production/' | relative_url }}#keeping-it-out-of-the-artifact-entirely).

## What your application needs {#what-your-application-needs}

- Java {{ site.java_version }} or newer.
- Spring Boot {{ site.spring_boot_version }}. Earlier 4.x releases are untested.
- A servlet web application.

Peekaboot serves the dashboard and the toolbar on servlet (Spring MVC) applications only. On
WebFlux or a non-web application they are absent, and startup is unaffected.

## Run your app {#run-your-app}

Start it from your IDE, with `mvn spring-boot:run` or with `gradle bootRun`. Peekaboot turns
itself and the [dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}) on for these launches.
The toolbar docks to the bottom of every HTML page your app renders.

<figure class="image">
  <img src="{{ '/assets/img/screenshots/toolbar-collapsed-light.png' | relative_url }}"
       alt="The collapsed dev toolbar at the bottom of an orders page, showing a 200 status badge, GET /orders, the controller method, the duration, 84 spans, 26 queries in 29ms, 1 log and a copyable trace id"
       loading="lazy">
</figure>

Click the bar for the request's trace detail, with its request and response, spans, queries and
logs. See [Dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}).

<div class="pk-callout" markdown="1">
Set `peekaboot.dev-toolbar: false` to turn the toolbar off and keep the dashboard.
</div>

<div class="pk-callout pk-callout--warning" markdown="1">
A devcontainer counts as a container, so Peekaboot is off there. See [Configuration,
containers]({{ '/docs/configuration/' | relative_url }}#container-markers) for the properties
that turn it on.
</div>

## Open the dashboard {#open-the-dashboard}

The dashboard is at [`http://localhost:8080/peekaboot/`](http://localhost:8080/peekaboot/),
its API under [`http://localhost:8080/peekaboot/api/`](http://localhost:8080/peekaboot/api/).
On another port, context path or servlet path, use the URL on the `Peekaboot Dashboard:` line
Peekaboot logs once the application is ready. See
[Configuration]({{ '/docs/configuration/' | relative_url }}#the-urls-in-the-summary).

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-overview-light.png' | relative_url }}"
       alt="The Overview tab with the Started at, Startup, Ready after and Uptime tiles, a health banner reading UP, and the Build, Git, Spring, Java, System and Machine cards"
       loading="lazy">
</figure>

## What you get immediately {#what-you-get-immediately}

- The [dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}) on every HTML page your app
  renders
- Overview: build and Git info, Spring Boot and Java versions, system and JVM details, and
  datasource status
- Environment and Config: every property source Spring resolved, and every
  `@ConfigurationProperties` bean's effective values
- Flyway migration history, runtime logger levels, and scheduled tasks
- Every meter in Micrometer's registry on Meters, and the key ones charted over time on
  [Insights]({{ '/docs/insights/' | relative_url }})
- Traces with spans and SQL queries for the last 1000 requests, oldest evicted first
  (`peekaboot.tracing.max-traces`; see [Traces]({{ '/docs/traces/' | relative_url }}#the-three-buckets))

## Turn it on outside a local run {#turn-it-on-outside-a-local-run}

Peekaboot is off for a deployment or a test until you set `peekaboot.enabled=true`.
[Configuration, when Peekaboot is on]({{ '/docs/configuration/' | relative_url }}#when-peekaboot-is-on)
lists every switch the launch decides. Read [Do I want this in
production?]({{ '/docs/in-production/' | relative_url }}) before you turn it on anywhere shared.

## What the starter brings {#what-the-starter-brings}

Adding `{{ site.maven_artifact }}` pulls in:

- `{{ site.maven_group }}:peekaboot-spring-boot-autoconfigure`
- `spring-boot-starter`
- `spring-boot-starter-actuator`
- `spring-boot-starter-opentelemetry`
- `datasource-micrometer-spring-boot` and `datasource-micrometer-opentelemetry`, which capture
  your JDBC queries

Peekaboot requires the OpenTelemetry bridge the starter brings. Brave is not supported: with
the Brave bridge the Traces tab stays empty and the toolbar never shows a trace.

## If you exclude one of them {#graceful-degradation}

Startup never fails because of a missing piece.

| Missing | What happens |
|---|---|
| A Micrometer `Tracer` bean | The dev toolbar is absent. The rest of the dashboard works. |
| The OpenTelemetry SDK | The Traces tab explains that the SDK is missing. |
| A Micrometer `MeterRegistry` bean | The Meters and Insights tabs, the insights API and the Overview stat tiles are absent. See [Insights]({{ '/docs/insights/' | relative_url }}#when-the-tab-isnt-there). |

## Next {#next}

- [The dashboard]({{ '/docs/dashboard/' | relative_url }})
- [Configuration]({{ '/docs/configuration/' | relative_url }})
