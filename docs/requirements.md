---
title: Requirements
lead: What your application needs, and what happens when a piece of it is missing.
permalink: /docs/requirements/
---

## What your application needs

- **Java 25 or newer**
- **Spring Boot 4.0 or newer**
- **A servlet web application** &mdash; the dashboard is served through Spring MVC; it is not
  usable in a reactive (WebFlux) or non-web application (see
  [Graceful degradation](#graceful-degradation) below)

## What the starter brings

Adding `peekaboot-spring-boot-starter` pulls in exactly four dependencies:

| Dependency | What it's for |
|---|---|
| `org.peekaboot:peekaboot-spring-boot-autoconfigure` | Peekaboot's own auto-configuration, backend services and dashboard frontend |
| `spring-boot-starter` | the base Spring Boot starter |
| `spring-boot-starter-actuator` | the Health, Info, Env, Loggers, Flyway, Scheduled Tasks and Metrics endpoints Peekaboot reads in-process |
| `spring-boot-starter-opentelemetry` | the OpenTelemetry SDK and the Micrometer Tracing bridge that feed the in-memory trace store |

Caffeine, which backs the in-memory trace store's bounded caches, is not declared by the
starter itself &mdash; it arrives transitively through `peekaboot-backend`, a dependency of the
autoconfigure module.

## Graceful degradation

Peekaboot's features are conditional individually, so a missing piece disables that piece
rather than the whole starter.

**No `Tracer` bean.** The dev toolbar's two filters &mdash; the one that captures
request/response detail and the one that injects the toolbar into HTML &mdash; both require a
Micrometer `Tracer` bean (`@ConditionalOnBean(Tracer.class)` in `DevToolbarAutoConfiguration`).
Without one, neither registers: the toolbar produces nothing, though the dashboard's other
tabs are unaffected. The starter provides a `Tracer` bean by default through
`spring-boot-starter-opentelemetry`; you would only lose it by explicitly excluding that
bridge.

**No OpenTelemetry SDK on the classpath.** The bridge that exports spans into the trace store
(`OtelTracingAutoConfiguration`) is conditional on `io.opentelemetry.sdk.trace.export.SpanExporter`
being present. Without it, the trace store itself is still created
(`PeekabootTracingAutoConfiguration` carries no such condition), but nothing populates it
&mdash; the Traces tab stays empty.

**A reactive (WebFlux) application.** The dashboard's static assets are registered through
Spring MVC's servlet-based `WebMvcConfigurer` (`PeekabootWebConfig`), so the UI does not serve
under WebFlux. The dev toolbar filters and the tracing interceptor are additionally guarded by
`@ConditionalOnWebApplication(Type.SERVLET)`. Peekaboot is not usable on a reactive stack.

**A non-web application.** With no embedded server there is nothing for a browser or `curl`
to reach, regardless of which Peekaboot beans register.
