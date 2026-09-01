---
title: Quick start
lead: One dependency, no configuration, the toolbar on your next run.
permalink: /docs/quick-start/
---

<div class="pk-callout pk-callout--warning" markdown="1">
Peekaboot is pre-release: no version has been published yet, and `{{ site.peekaboot_version }}`
is a snapshot coordinate Maven Central can't serve. Until a release goes out, build it
yourself from the [source repo]({{ site.repository_url }}) with `mvn clean install`.
</div>

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

## Run your app

Run it the way you already do &mdash; from your IDE, `mvn spring-boot:run`, or `gradle bootRun`.
Nothing else to configure: Peekaboot detects that launch as local development and turns
itself, and the [dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}), on. Open any page
and it's already there:

<figure class="image">
  <img src="{{ '/assets/img/screenshots/toolbar-collapsed-light.png' | relative_url }}"
       alt="The collapsed dev toolbar docked at the bottom of the page, showing a 200 status badge, GET /orders, the controller method, duration, query count and duration, and a copyable trace id"
       loading="lazy">
</figure>

Request and response detail, the trace view, and logs correlated to the request are
one click away &mdash; see [Dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}) for what
each part shows.

<div class="pk-callout" markdown="1">
Set `peekaboot.dev-toolbar: false` to turn the toolbar off while keeping the rest of the
dashboard; see [Configuration]({{ '/docs/configuration/' | relative_url }}#local-run)
for exactly what counts as a local run.
</div>

A dashboard comes with it too, at
[`http://localhost:8080/peekaboot/`](http://localhost:8080/peekaboot/); its API sits under
[`http://localhost:8080/peekaboot/api/`](http://localhost:8080/peekaboot/api/). If your
application doesn't run on port 8080, you don't have to work the address out: the
application-ready summary Peekaboot logs at startup prints the dashboard's real URL,
context path and all, on a `Peekaboot Dashboard:` line &mdash; see
[Configuration]({{ '/docs/configuration/' | relative_url }}#the-urls-in-the-summary).

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-dashboard-light.png' | relative_url }}"
       alt="The Peekaboot dashboard's Overview tab, showing Build, Git, Spring, Java, System, JVM Defaults and Datasource cards for a running application"
       loading="lazy">
</figure>

## What you get immediately

- The dev toolbar, on every page: request and response detail, the trace view, and
  logs correlated to the request &mdash; see [Dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }})
- The Overview tab: build and Git info, Spring Boot and Java versions, system and JVM
  details, and datasource status
- Environment and Config tabs: every property source Spring resolved, and every
  `@ConfigurationProperties` bean's effective values
- Flyway migration history, runtime logger levels, and scheduled task listings
- Every meter in Micrometer's registry on the Meters tab, and the curated ones charted over
  time on [Insights]({{ '/docs/insights/' | relative_url }}) &mdash; no Prometheus, no
  scrape endpoint
- Full request traces &mdash; spans and SQL queries &mdash; for the last thousand requests
  your app has served, kept for thirty minutes (`peekaboot.tracing.max-traces`; see
  [Tracing]({{ '/docs/tracing/' | relative_url }}#the-three-buckets))

## Next

- [The dashboard]({{ '/docs/dashboard/' | relative_url }}) &mdash; a tour of every tab.
- [Configuration]({{ '/docs/configuration/' | relative_url }}) &mdash; every property, its
  default, and what it controls.
