---
title: Requirements
lead: What your application needs, and what happens when a piece of it is missing.
permalink: /docs/requirements/
---

## What your application needs

- **Java 25 or newer**
- **Spring Boot 4.1** &mdash; built and tested against this version; earlier 4.x releases are untested
- **A servlet web application** &mdash; the dashboard is served through Spring MVC

On a non-servlet application &mdash; WebFlux, or no web application at all &mdash; the
dashboard and the dev toolbar simply don't register. Startup isn't affected, nothing
errors, and there's just no `/peekaboot/**` to reach; the defaults Peekaboot would set for
the dashboard's benefit ([what Peekaboot
sets]({{ '/docs/configuration/' | relative_url }}#what-peekaboot-sets-in-your-application))
are not applied either. Two things carry no web condition
and still run wherever `peekaboot.enabled` resolves to `true`: the startup and shutdown
summaries (`peekaboot.lifecycle.enabled`) and, on a [local
run]({{ '/docs/configuration/' | relative_url }}#local-run), the run-history file under
`~/.peekaboot/` (`peekaboot.storage.enabled`). Each switch turns its own one off &mdash;
see [Configuration]({{ '/docs/configuration/' | relative_url }}#peekabootlifecycle).

## What the starter brings

Adding `peekaboot-spring-boot-starter` pulls in exactly four dependencies:

| Dependency | What it's for |
|---|---|
| `org.peekaboot:peekaboot-spring-boot-autoconfigure` | Peekaboot's own auto-configuration, backend services and dashboard frontend |
| `spring-boot-starter` | the base Spring Boot starter |
| `spring-boot-starter-actuator` | the Overview, Env, Loggers, Flyway, Config and Scheduled Tasks endpoints Peekaboot reads in-process &mdash; the Meters and Insights tabs read Micrometer's `MeterRegistry` directly, not an actuator endpoint, though the registry bean itself is Actuator's |
| `spring-boot-starter-opentelemetry` | the OpenTelemetry SDK and the Micrometer Tracing bridge that feed the in-memory trace store |

Brave is not supported &mdash; Peekaboot reads spans from the OpenTelemetry SDK; a host on
Brave gets no traces and no toolbar.

## Graceful degradation

The pieces below degrade gracefully when something they depend on is missing, rather than
failing to start. This assumes you're already running a servlet web application; if
you're not, see above &mdash; that's a different situation entirely (the dashboard itself
doesn't register, rather than registering and then finding something missing).

**No `Tracer` bean.** Without a Micrometer `Tracer` bean, the dev toolbar doesn't
register at all &mdash; it produces nothing, though the rest of the dashboard is
unaffected. The starter provides a `Tracer` bean by default; you'd only lose it by
explicitly excluding the OpenTelemetry starter.

**No OpenTelemetry SDK on the classpath.** The trace store itself is still created, but
nothing populates it &mdash; the Traces tab stays empty rather than missing entirely.

**No Micrometer `MeterRegistry` bean.** The Meters tab and the whole insights feature
&mdash; collector, `/api/insights/**` endpoints, Insights tab, and the Overview tab's
stat-tile row &mdash; are all absent rather than empty; there's nothing to sample without
a registry. Everything else is unaffected. The starter provides one through
`spring-boot-starter-actuator`, so this only comes up if you've excluded it or explicitly
disabled the registry. See [Insights]({{ '/docs/insights/' | relative_url }}#when-the-tab-isnt-there).
