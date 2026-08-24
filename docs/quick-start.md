---
title: Quick start
lead: One dependency, no configuration, a dashboard on your next run.
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
itself on.

Open the dashboard at
[`http://localhost:8080/peekaboot/`](http://localhost:8080/peekaboot/); its API sits under
[`http://localhost:8080/peekaboot/api/`](http://localhost:8080/peekaboot/api/).

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-dashboard-light.png' | relative_url }}"
       alt="The Peekaboot dashboard's Dashboard tab, showing Build, Git, Spring, Java, System, JVM Defaults and Datasource cards for a running application"
       loading="lazy">
</figure>

## What you get immediately

- The Dashboard tab: build and Git info, Spring Boot and Java versions, system and JVM
  details, and datasource status
- Environment and Config tabs: every property source Spring resolved, and every
  `@ConfigurationProperties` bean's effective values
- Flyway migration history, runtime logger levels, and scheduled task listings
- Metrics from Micrometer's registry
- Full request traces &mdash; spans and SQL queries &mdash; for every request your app
  has served since it started

<div class="pk-callout" markdown="1">
The toolbar you may have heard about is part of this too: on a local run like the one
above, `peekaboot.dev-toolbar` defaults on along with everything else, so it's already
docked at the bottom of your pages. That flag also turns on correlating log messages to
each trace and capturing full request/response detail (headers, query/form parameters,
resolved controller), neither of which is captured without it. Set
`peekaboot.dev-toolbar: false` to turn it off while keeping the rest of the dashboard; see
[How activation works]({{ '/docs/how-activation-works/' | relative_url }}) for exactly
what counts as a local run.
</div>

## Next

- [The dashboard]({{ '/docs/dashboard/' | relative_url }}) &mdash; a tour of every tab.
- [Configuration]({{ '/docs/configuration/' | relative_url }}) &mdash; every property, its
  default, and what it controls.
