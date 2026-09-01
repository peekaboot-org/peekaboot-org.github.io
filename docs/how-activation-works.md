---
title: How activation works
lead: Whether Peekaboot ends up running somewhere it shouldn't comes down to one detection and one property.
permalink: /docs/how-activation-works/
---

## What counts as local

`peekaboot.enabled` has no fixed default. Before your own configuration is read,
Peekaboot works out whether it's running locally and sets the default from that &mdash;
at the lowest possible precedence, so any `application.yml` entry, environment variable,
or system property you set always wins, in either direction.

The rule is about the class loader, not about where the process runs, and it is worth
knowing exactly
([`LocalDevDetector`]({{ site.repository_url }}/blob/HEAD/peekaboot-spring-boot-autoconfigure/src/main/java/org/peekaboot/autoconfigure/LocalDevDetector.java),
the same heuristic Spring Boot DevTools uses to decide whether to enable itself). A launch
counts as local when the `main` thread runs on the JDK's application class loader
(`AppClassLoader`) with no test-framework or AOT frame on its stack &mdash; or under
DevTools' `RestartClassLoader`, which only ever exists in a local launch.

**Not local**, so off by default: a `java -jar` of the repackaged fat jar (it runs on
Spring Boot's `LaunchedClassLoader`), a war in a servlet container (the container's webapp
loader), a native image, an AOT-processing run, and a test (JUnit, Spring Boot's test
support, Cucumber).

**Local**, so on by default: an IDE run, `mvn spring-boot:run`, `gradle bootRun` &mdash;
and every other launch that puts your classes on the application class loader, including
ones that are nowhere near a developer's machine: `java -cp lib/*:app.jar com.example.App`,
a [Jib](https://github.com/GoogleContainerTools/jib) image (its entrypoint is a `java -cp`
command), and the slim-jar layout `java -Djarmode=tools -jar app.jar extract` produces,
which runs on the application class loader even though it is started with `java -jar`. A
container is whichever of these its entrypoint is; the word itself decides nothing.

Peekaboot cannot tell an exploded classpath on a laptop from the same layout in
production. If you deploy any way other than `java -jar` of the fat jar, set
`peekaboot.enabled=false` explicitly in that environment, or [exclude the
starter](#keeping-the-jar-out-of-production-builds) from the artifact.

The same detection also supplies the defaults for `peekaboot.dev-toolbar` and
`peekaboot.storage.enabled` &mdash; on for a local run, off elsewhere &mdash;
independently of whatever `peekaboot.enabled` itself resolves to. Turning Peekaboot on
deliberately in a shared environment neither injects the toolbar into that application's
pages nor writes Peekaboot's files into that host's home directory; set either property
explicitly if you want them there. The same detection also decides whether the Environment
and Config tabs show real values or `******` by default. See [Configuration]({{ '/docs/configuration/' | relative_url }}) and
[Security]({{ '/docs/security/' | relative_url }}#show-values-always-only-on-a-local-run)
for what each of those actually controls.

## Per-feature switches

Every feature is gated independently once `peekaboot.enabled` resolves to `true`; nothing
below is reachable while it doesn't.

| Feature | Switch | Additional requirement |
|---|---|---|
| Dashboard UI & API | `peekaboot.enabled=true` | A servlet web application; Actuator's health and info endpoints on the classpath (present via the starter) |
| Debug Toolbar | `peekaboot.enabled=true` **and** `peekaboot.dev-toolbar=true` (auto-detected: on for a local run, off elsewhere, same detection as `peekaboot.enabled`, not keyed on it) | A servlet web application; a Micrometer `Tracer` bean (present by default); `peekaboot.tracing.enabled=true` (on by default) &mdash; without it, no spans reach the store and the toolbar has no trace data to show |
| In-Memory Tracing | `peekaboot.enabled=true` **and** `peekaboot.tracing.enabled=true` (on by default) | The OpenTelemetry SDK on the classpath (present via the starter) |
| Startup Summary | `peekaboot.enabled=true` **and** `peekaboot.lifecycle.enabled=true` (on by default) | None |
| Persisted history | `peekaboot.enabled=true` **and** `peekaboot.storage.enabled=true` (auto-detected: on for a local run, off elsewhere, same detection as `peekaboot.enabled`, not keyed on it) | A writable directory &mdash; an unwritable one is logged once and everything carries on in memory. See [Configuration]({{ '/docs/configuration/' | relative_url }}#peekabootstorage) |
| Observability Defaults | `peekaboot.enabled` resolves to `true` (detection or override) | None &mdash; skipped entirely while disabled |

If your application isn't a servlet web app &mdash; WebFlux, or no web application at all
&mdash; the dashboard and toolbar simply don't register: startup isn't affected, nothing
crashes, there's just nothing to see at `/peekaboot/**`. The rows above that carry no
servlet requirement still apply, and two of them leave a visible mark: the startup and
shutdown summaries are logged (`peekaboot.lifecycle.enabled`) and, on a local run, the
run history is written under `~/.peekaboot/` (`peekaboot.storage.enabled`). See
[Requirements]({{ '/docs/requirements/' | relative_url }}) for the full picture.

## Why tests count as "not local"

A JUnit test run can look like a local launch on the surface &mdash; same thread, same
class loader &mdash; but Peekaboot treats it as not local anyway, specifically so tests
don't accidentally carry the dashboard, the toolbar, and the observability defaults into
CI.

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
