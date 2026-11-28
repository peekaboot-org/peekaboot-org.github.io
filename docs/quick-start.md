---
title: Quick start
lead: Add the starter, run your app, open the dashboard.
permalink: /docs/quick-start/
redirect_from:
  - /docs/
  - /docs/requirements/
---

## Add the dependency {#add-the-dependency}

Java {{ site.java_version }} or newer, Spring Boot {{ site.spring_boot_version }} and a servlet
web application. On WebFlux or a non-web application the dashboard and the toolbar are absent,
and startup is unaffected.

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

On Gradle with Spring Boot 4.1, import Boot's BOM through the `io.spring.dependency-management`
plugin or `enforcedPlatform(...)`. A plain `platform(...)` lets Peekaboot raise your app to
Spring Boot 4.2.

## Run your app {#run-your-app}

Start it from your IDE, with `mvn spring-boot:run` or with `gradle bootRun`. Peekaboot turns
itself on for these launches.

<div class="pk-callout pk-callout--warning" markdown="1">
{% include facts/local-run-disk.md %}
</div>

## Open the dashboard {#open-the-dashboard}

The dashboard is at [`http://localhost:8080/peekaboot/`](http://localhost:8080/peekaboot/),
its API under [`http://localhost:8080/peekaboot/api/`](http://localhost:8080/peekaboot/api/).
On another port, context path or servlet path, use the URL on the `Peekaboot Dashboard:` line
Peekaboot logs once the application is ready. See
[Configuration]({{ '/docs/configuration/' | relative_url }}#the-urls-in-the-summary).

The dashboard opens from the machine the application runs on. From another machine, use an SSH
tunnel or set `peekaboot.remote-access.enabled=true`.
[Troubleshooting]({{ '/docs/troubleshooting/' | relative_url }}#dashboard-403) shows both, and
[Security]({{ '/docs/security/' | relative_url }}#who-can-reach-peekaboot) has the rule.

{% include screenshot.html name="dashboard-overview" %}

## What you get immediately {#what-you-get-immediately}

The [dashboard]({{ '/docs/dashboard/' | relative_url }}) with its tabs, the [dev
toolbar]({{ '/docs/dev-toolbar/' | relative_url }}) on every HTML page your app renders and the
[error page]({{ '/docs/error-page/' | relative_url }}) in place of Spring Boot's whitelabel page.

<div class="pk-callout" markdown="1">
Set `peekaboot.dev-toolbar.enabled: false` to turn the toolbar off and keep the dashboard.
</div>

<div class="pk-callout pk-callout--warning" markdown="1">
A devcontainer counts as a container, so Peekaboot is off there. See [Configuration,
containers]({{ '/docs/configuration/' | relative_url }}#container-markers) for the properties
that turn it on.
</div>

## Turn it on outside a local run {#turn-it-on-outside-a-local-run}

Peekaboot is off for a deployment or a test until you set `peekaboot.enabled=true`. See
[Configuration]({{ '/docs/configuration/' | relative_url }}#when-peekaboot-is-on) and, before you
do it anywhere shared, [Production use]({{ '/docs/in-production/' | relative_url }}). That page
also covers keeping the starter out of the production artifact and what it puts on the
classpath.
