---
title: Requirements
lead: What your application needs, and what happens when a piece of it is missing.
permalink: /docs/requirements/
---

## What your application needs

- **Java 25 or newer**
- **Spring Boot 4.1** &mdash; built and tested against this version; earlier 4.x releases are untested
- **A servlet web application** &mdash; the dashboard is served through Spring MVC

`PeekabootAutoConfiguration` &mdash; the configuration that component-scans Peekaboot's
dashboard and, with it, `PeekabootWebConfig` (a `WebMvcConfigurer`, a servlet-only Spring
MVC type) &mdash; carries `@ConditionalOnWebApplication(Type.SERVLET)`, the same guard
`DevToolbarAutoConfiguration` and `TracingInterceptorAutoConfiguration` also carry. On a
non-servlet application (WebFlux, or no web application at all), the condition simply
doesn't match: the dashboard, its controllers and its actuator wiring never register,
application startup is unaffected, and nothing further needs to be done on your side.

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

The pieces below degrade gracefully when something they depend on is missing &mdash; each is
gated by its own `@ConditionalOn*` annotation that simply skips it. This assumes you're
already running a servlet web application; if you're not, see above &mdash; that's a
different situation entirely (the dashboard itself doesn't register, rather than
registering and then finding something missing).

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
