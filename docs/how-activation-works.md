---
title: How activation works
lead: Whether Peekaboot ends up running somewhere it shouldn't comes down to one detection and one property.
permalink: /docs/how-activation-works/
---

## The heuristic

`peekaboot.enabled` is a normal Spring Boot property with one twist: before your own
configuration is read, an `EnvironmentPostProcessor`
(`PeekabootDefaultsEnvironmentPostProcessor`) computes a default for it and adds that default
at the lowest possible precedence &mdash; so any `application.yml` entry, environment
variable, or system property you set always wins, in either direction.

The detection itself (`LocalDevDetector`) mirrors the heuristics Spring Boot DevTools uses:

1. Running as a native image always resolves to `false`, before anything else is checked.
2. Otherwise, if the current thread's context class loader is DevTools' `RestartClassLoader`
   (the `restartedMain` thread Boot DevTools relaunches your app on), the result is `true`
   immediately &mdash; DevTools only relaunches like that for a local launch in the first
   place, so the class loader alone is proof.
3. Otherwise, the result is `true` only when *all* of the following hold: the thread is named
   `main`; its context class loader is the JDK's own `AppClassLoader` &mdash; not Spring
   Boot's `LaunchedClassLoader` (a packaged, executable jar) and not a servlet container's
   webapp loader (a deployed war); and the call stack carries no `org.junit.*`,
   `org.springframework.boot.test.*`, Spring Boot's AOT processor, or `cucumber.runtime.*`
   frames.

In practice: an IDE run, `mvn spring-boot:run`, and `gradle bootRun` all default to on. A
`java -jar` of the packaged artifact, a container, a native image, and an AOT-processed build
all default to off.

## Per-feature switches

Every feature is gated independently once `peekaboot.enabled` resolves to `true`; nothing
below is reachable while it doesn't.

| Feature | Switch | Additional requirement |
|---|---|---|
| Dashboard UI & API | `peekaboot.enabled=true` | A servlet web application; Actuator's `HealthEndpoint`/`InfoEndpoint` on the classpath (present via the starter) |
| Debug Toolbar | `peekaboot.enabled=true` **and** `peekaboot.dev-toolbar=true` (off by default) | A servlet web application; a Micrometer `Tracer` bean (present by default via `spring-boot-starter-opentelemetry`) |
| In-Memory Tracing | `peekaboot.enabled=true` **and** `peekaboot.tracing.enabled=true` (on by default) | The OpenTelemetry SDK on the classpath, to actually feed spans into the store (present via the starter) |
| Startup Summary | `peekaboot.enabled=true` **and** `peekaboot.lifecycle.enabled=true` (on by default) | None |
| Observability Defaults | `peekaboot.enabled` resolves to `true` (detection or override) | None &mdash; applied as a lowest-precedence property source, skipped entirely while disabled |

`peekaboot.lifecycle.enabled` is a real switch (`@ConditionalOnProperty` on
`PeekabootLifecycleAutoConfiguration`), but there is no `@ConfigurationProperties` class behind
it &mdash; it will not show up on the dashboard's own Config tab, even though it controls real
behaviour.

## Why tests count as "not local"

A JUnit run under Maven Surefire or Gradle's test task typically ends up on a thread named
`main` with the plain `AppClassLoader` &mdash; the same shape as a genuine local launch.
`LocalDevDetector` tells the two apart with the stack-trace check from step 3 above: any frame
from `org.junit.*`, `org.springframework.boot.test.*`, or `cucumber.runtime.*` disqualifies
the detection, so tests default to `peekaboot.enabled=false` even when run from the same IDE
as your local launch.

If a test needs Peekaboot active, set the property explicitly:

```java
@SpringBootTest(properties = "peekaboot.enabled=true")
```

## Turning it on somewhere else

Setting `peekaboot.enabled=true` &mdash; as an `application.yml` entry, an environment
variable, or a system property &mdash; overrides the detection in either direction, including
in a deployed environment.

<div class="pk-callout pk-callout--warning" markdown="1">
Peekaboot's dashboard and API have no authentication of their own. Enabling it anywhere
reachable outside your own machine means anyone who can reach `/peekaboot/**` can read your
configuration, environment, and request traces &mdash; read
[Security]({{ '/docs/security/' | relative_url }}) first.
</div>

## Keeping the jar out of production builds

If you'd rather Peekaboot never ship at all, exclude it at packaging time instead of relying
on the default being off.

**Maven** &mdash; exclude it from the repackaged executable jar via the Spring Boot Maven
plugin:

```xml
<plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
    <configuration>
        <excludes>
            <exclude>
                <groupId>org.peekaboot</groupId>
                <artifactId>peekaboot-spring-boot-starter</artifactId>
            </exclude>
        </excludes>
    </configuration>
</plugin>
```

**Gradle** &mdash; declare it `developmentOnly` instead of `implementation`; the Spring Boot
Gradle plugin keeps `developmentOnly` dependencies off the production runtime classpath and
out of the executable jar, while still making them available for `bootRun`:

```groovy
developmentOnly("org.peekaboot:peekaboot-spring-boot-starter:{{ site.peekaboot_version }}")
```
