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
errors, and there's nothing further to do on your side; there's just no `/peekaboot/**`
to reach.

## What the starter brings

Adding `peekaboot-spring-boot-starter` pulls in exactly four dependencies:

| Dependency | What it's for |
|---|---|
| `org.peekaboot:peekaboot-spring-boot-autoconfigure` | Peekaboot's own auto-configuration, backend services and dashboard frontend |
| `spring-boot-starter` | the base Spring Boot starter |
| `spring-boot-starter-actuator` | the Health, Info, Env, Loggers, Flyway, Config and Scheduled Tasks endpoints Peekaboot reads in-process &mdash; Metrics is read directly from Micrometer's `MeterRegistry`, not from an actuator endpoint |
| `spring-boot-starter-opentelemetry` | the OpenTelemetry SDK and the Micrometer Tracing bridge that feed the in-memory trace store |

Caffeine, which backs the in-memory trace store's bounded caches, is not declared by the
starter itself &mdash; it arrives transitively through `peekaboot-backend`, a dependency of the
autoconfigure module.

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
