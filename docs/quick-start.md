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

- Java 25 or newer.
- Spring Boot 4.1. Earlier 4.x releases are untested.
- A servlet web application.

Peekaboot serves the dashboard and the toolbar on servlet (Spring MVC) applications only. On
WebFlux or a non-web application they are absent, and startup is unaffected.

## Run your app {#run-your-app}

Start it from your IDE, with `mvn spring-boot:run` or with `gradle bootRun`. Peekaboot turns
itself and the [dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}) on for these launches.
The toolbar docks to the bottom of every HTML page your app renders.

<figure class="image">
  <img src="{{ '/assets/img/screenshots/toolbar-collapsed-light.png' | relative_url }}"
       alt="The collapsed dev toolbar docked at the bottom of the page, showing a 200 status badge, GET /orders, the controller method, duration, query count and duration, and a copyable trace id"
       loading="lazy">
</figure>

Click the bar for request and response detail, the trace view and the request's logs. See
[Dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}).

<div class="pk-callout" markdown="1">
Set `peekaboot.dev-toolbar: false` to turn the toolbar off and keep the dashboard.
</div>

<div class="pk-callout pk-callout--warning" markdown="1">
**Peekaboot is off in a devcontainer.** A container never counts as a local run. Turn it on with
the properties below; see [Configuration,
containers]({{ '/docs/configuration/' | relative_url }}#container-markers).
</div>

## Turn it on outside a local run {#turn-it-on-outside-a-local-run}

These properties default to `true` for a local run and to `false` for `java -jar`, wars,
native images, containers and tests. Any value you set wins.

| Property | Default | Effect |
|---|---|---|
| `peekaboot.enabled` | local run only | The dashboard, its API and Peekaboot's Spring Boot defaults. Every other switch also needs it. |
| `peekaboot.dev-toolbar` | local run only | The toolbar, log capture and request-detail capture. |
| `peekaboot.storage.enabled` | local run only | Keeps the charts and the run history in `~/.peekaboot` across restarts. |
| `peekaboot.error-page.enabled` | local run only | Peekaboot's error page in place of Spring Boot's whitelabel page. |
| `peekaboot.stack-trace.fold` | local run only | Folds framework frames on the error page and in the Logs tab. |

Outside a local run, Peekaboot also protects `/peekaboot/**` with HTTP Basic
(`peekaboot.security.enabled`). Read [Do I want this in
production?]({{ '/docs/in-production/' | relative_url }}) before you turn it on anywhere shared.
All other properties are in [Configuration]({{ '/docs/configuration/' | relative_url }}#local-run).

## Open the dashboard {#open-the-dashboard}

The dashboard is at [`http://localhost:8080/peekaboot/`](http://localhost:8080/peekaboot/),
its API under [`http://localhost:8080/peekaboot/api/`](http://localhost:8080/peekaboot/api/).
On another port or context path, use the URL on the `Peekaboot Dashboard:` line Peekaboot
logs once the application is ready. See
[Configuration]({{ '/docs/configuration/' | relative_url }}#the-urls-in-the-summary).

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-overview-light.png' | relative_url }}"
       alt="The Peekaboot dashboard's Overview tab, showing Build, Git, Spring, Java, System, JVM Defaults and Datasource cards for a running application"
       loading="lazy">
</figure>

## What you get immediately {#what-you-get-immediately}

- The dev toolbar on every page: request and response detail, the trace view, and the
  request's logs
- Overview: build and Git info, Spring Boot and Java versions, system and JVM details, and
  datasource status
- Environment and Config: every property source Spring resolved, and every
  `@ConfigurationProperties` bean's effective values
- Flyway migration history, runtime logger levels, and scheduled tasks
- Every meter in Micrometer's registry on Meters, and the key ones charted over time on
  [Insights]({{ '/docs/insights/' | relative_url }})
- Traces with spans and SQL queries for the last 1000 requests, oldest evicted first
  (`peekaboot.tracing.max-traces`; see [Traces]({{ '/docs/traces/' | relative_url }}#the-three-buckets))

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
| The OpenTelemetry SDK | The Traces tab stays empty. |
| A Micrometer `MeterRegistry` bean | The Meters and Insights tabs, the insights API and the Overview stat tiles are absent. See [Insights]({{ '/docs/insights/' | relative_url }}#when-the-tab-isnt-there). |

## Next {#next}

- [The dashboard]({{ '/docs/dashboard/' | relative_url }})
- [Configuration]({{ '/docs/configuration/' | relative_url }})
