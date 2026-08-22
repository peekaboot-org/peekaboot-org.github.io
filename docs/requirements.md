---
title: Requirements
lead: What your application needs, and what happens when a piece of it is missing.
permalink: /docs/requirements/
---

## What your application needs

- **Java 25 or newer**
- **Spring Boot 4.0 or newer**
- **A servlet web application** &mdash; the dashboard is served through Spring MVC

<div class="pk-callout pk-callout--warning" markdown="1">
**This isn't a "quietly stays off" case.** `PeekabootAutoConfiguration` &mdash; the
configuration that component-scans Peekaboot's dashboard and, with it,
`PeekabootWebConfig` (a `WebMvcConfigurer`, a servlet-only Spring MVC type) &mdash; carries no
`@ConditionalOnWebApplication` guard, unlike `DevToolbarAutoConfiguration` and
`TracingInterceptorAutoConfiguration`, which both do. If `peekaboot.enabled` resolves to
`true` (the local-development default) and Spring MVC (`spring-webmvc`) isn't on your
classpath &mdash; the normal case for a WebFlux application, and for a non-web application
that doesn't happen to carry it too &mdash; expect application startup to fail while loading
that class, not for Peekaboot to simply stay inactive. This is read from the annotations and
the component scan, not from a reproduced failure. If your application isn't a servlet web
application, set `peekaboot.enabled=false` explicitly, or keep the starter out of it
entirely.
</div>

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

The pieces below degrade gracefully when something they depend on is missing &mdash; each is
gated by its own `@ConditionalOn*` annotation that simply skips it. This assumes you're
already running a servlet web application; if you're not, see the warning above, which is a
different situation entirely.

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
