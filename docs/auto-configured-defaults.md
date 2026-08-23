---
title: Auto-configured defaults
lead: What Peekaboot sets in your application by default, sourced from the two YAML files that actually set it.
permalink: /docs/auto-configured-defaults/
---

Peekaboot doesn't only add its own dashboard &mdash; it also nudges a handful of Spring
Boot and library defaults toward full observability, so the dashboard has something to
show without you configuring Actuator, tracing sampling, or SQL logging by hand. These
live in two YAML resources loaded by `PeekabootDefaultsEnvironmentPostProcessor`, applied
under different conditions.

## Two files, two conditions

| File | Applied when | Purpose |
|---|---|---|
| `peekaboot-defaults.yml` | `peekaboot.enabled` resolves to `true` | Full observability &mdash; health/env/info exposure, 100% trace sampling, Hibernate statistics, verbose SQL and HTTP logging |
| `peekaboot-no-push-defaults.yml` | Always &mdash; even when Peekaboot is disabled | Stops the starter's bundled OTLP metrics registry from silently pushing to `localhost:4318` |

Both are added via `environment.getPropertySources().addLast(...)`, and the post-processor
itself reports `Ordered.LOWEST_PRECEDENCE`. That means **any** property you set &mdash;
`application.yml`, a profile-specific file, an environment variable, a system property,
a `--command-line` argument &mdash; overrides an entry here. Nothing on this page is a
floor you have to work around; it's what applies when you haven't said otherwise.

The conditional file is skipped entirely while Peekaboot is disabled; the unconditional
one is not. This split exists because the starter puts Micrometer's OTLP registry on the
classpath regardless of whether Peekaboot itself is on, and that registry pushes metrics
on its own unless told not to &mdash; a risk that has nothing to do with whether you
actually want the dashboard.

## `peekaboot-defaults.yml`

```yaml
spring:
  jpa:
    properties:
      "[hibernate.generate_statistics]": true

management:
  endpoint:
    health:
      show-details: always
    env:
      show-values: always
    configprops:
      show-values: always
  info:
    env:
      enabled: true
    java:
      enabled: true
    os:
      enabled: true
    process:
      enabled: true
    git:
      enabled: true
  tracing:
    sampling:
      probability: 1.0
  observations:
    annotations:
      enabled: true

decorator:
  datasource:
    datasource-proxy:
      format-sql: true
      query:
        log-level: TRACE

logbook:
  predicate:
    include:
      - path: /api/**
  format:
    style: http
  strategy: body-only-if-status-at-least
  minimum-status: 400
```

| Property | Spring/library default | Peekaboot's default | Why |
|---|---|---|---|
| `spring.jpa.properties.[hibernate.generate_statistics]` | `false` | `true` | Exposes query counts, cache stats and slow queries through Hibernate's own statistics collector, which the dashboard reads for JPA-backed apps. |
| `management.endpoint.health.show-details` | `never` | `always` | Shows per-component health detail (datasource, disk space, custom indicators) in the Dashboard tab's health banner instead of a bare UP/DOWN. |
| `management.endpoint.env.show-values` | `never` | `always` | Left at Spring's default, the Environment tab would render `******` for every entry &mdash; `os.name` and `server.port` included &mdash; making the tab useless. Spring Boot 4.1 registers no default masking function, so `always` doesn't mean unmasked on Peekaboot's own dashboard/API surface (`/peekaboot/**`): Peekaboot's own masking engine runs over every value it hands back there, replacing what looks like a secret with `******` and leaving the rest readable. It does **not** reach Spring's own `/actuator/env` if your application exposes that endpoint itself. See [Security]({{ '/docs/security/' | relative_url }}#masking). |
| `management.endpoint.configprops.show-values` | `never` | `always` | Same reasoning, for the Config tab's bound `@ConfigurationProperties` values. |
| `management.info.env.enabled` | `false` | `true` | Publishes `info.*` properties (e.g. `info.app.*` set in your own `application.yml`) via `/actuator/info`, feeding the Dashboard tab &mdash; not OS/system environment variables, which the Environment tab already covers. |
| `management.info.java.enabled` | `false` | `true` | Exposes JVM vendor, version and runtime info in the Dashboard tab. |
| `management.info.os.enabled` | `false` | `true` | Exposes OS name, version and architecture in the Dashboard tab. |
| `management.info.process.enabled` | `false` | `true` | Exposes PID, uptime, CPU count and memory usage in the Dashboard tab. |
| `management.info.git.enabled` | `true` (unchanged) | `true` | Set explicitly for build traceability, even though it matches Spring Boot's own default &mdash; the source comment calls this out deliberately rather than relying on the implicit default. |
| `management.tracing.sampling.probability` | `0.1` (10%) | `1.0` (100%) | Samples every request so the Traces tab reflects everything, not a random 1-in-10 slice. |
| `management.observations.annotations.enabled` | `false` | `true` | Enables `@Observed`, `@Timed` and `@Counted` for declarative observability without extra wiring. |
| `decorator.datasource.datasource-proxy.format-sql` | `false` | `true` | Pretty-prints SQL in the Queries tab instead of a single unformatted line, for stacks whose JDBC spans carry `db.statement` or `jdbc.query[N]`. Only applies if `datasource-proxy` is on the classpath; see [Dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}#expanded-overlay) for the tag Peekaboot doesn't yet recognize. |
| `decorator.datasource.datasource-proxy.query.log-level` | `DEBUG` | `TRACE` | Captures query logging at the more detailed level the dashboard's Queries view relies on. |
| `logbook.predicate.include[0].path` | all paths | `/api/**` | Scopes Logbook's HTTP request/response logging to API traffic, reducing noise from static assets and the dashboard's own endpoints. Only applies if Logbook is on the classpath. |
| `logbook.format.style` | `json` | `http` | Renders logged requests in a human-readable HTTP-message format rather than JSON. |
| `logbook.strategy` | `without-body` | `body-only-if-status-at-least` (with `minimum-status: 400`) | Logs response bodies only for error responses, keeping successful-request logging light while still capturing detail when something fails. |

## `peekaboot-no-push-defaults.yml`

```yaml
management:
  otlp:
    metrics:
      export:
        enabled: false
```

| Property | Spring default | Peekaboot's default | Why |
|---|---|---|---|
| `management.otlp.metrics.export.enabled` | `true` | `false` | The starter pulls in `spring-boot-starter-opentelemetry`, which puts Micrometer's OTLP registry on the classpath. Left at Spring's own default, that registry would push metrics to `http://localhost:4318` on its own, with no explicit configuration and no collector necessarily listening there. Telemetry shouldn't leave the process unless the application opts in. |

Traces and logs need no equivalent entry here: Spring Boot only creates OTLP exporters for
them when an endpoint is explicitly configured
(`management.opentelemetry.tracing.export.otlp.endpoint` and similar) &mdash; there's no
default-on push to guard against for those two.

Because this file applies unconditionally, it's the one default on this page that still
takes effect with Peekaboot fully disabled.

<div class="pk-callout pk-callout--warning" markdown="1">
**Some of these widen what's exposed or what runs, beyond what a default Spring Boot app
would do:**

- `management.endpoint.health.show-details: always` &mdash; per-component health detail
  (datasource, disk, custom indicators) is always readable, not just the aggregate status.
- `management.endpoint.env.show-values: always` and
  `management.endpoint.configprops.show-values: always` &mdash; property *values* are
  readable through both endpoints, kept at `always` deliberately even though Spring Boot
  4.1 registers no default masking function of its own. On Peekaboot's own dashboard/API
  surface (`/peekaboot/**`) this doesn't leave those values unmasked: Peekaboot runs its
  own masking engine over every value it hands back there, on by default, independent of
  the `show-values` setting or any `SanitizingFunction` your application may or may not
  supply. Peekaboot registers no `SanitizingFunction` of its own, though, so if your
  application also exposes `/actuator/env` or `/actuator/configprops` over HTTP itself,
  *that* path is widened with no masking of any kind &mdash; Peekaboot's masking engine
  never runs there. See [Security &mdash; masking]({{ '/docs/security/' | relative_url }}#masking)
  for exactly what it catches, where it runs, and why `show-values` stays `always`
  regardless.
- `management.info.env.enabled: true` &mdash; publishes `info.*` properties through
  `/actuator/info`, a separate exposure from the `show-values` masking above. This is
  not OS/system environment variables &mdash; those are what the Environment tab
  (`show-values` above) already covers.
- `management.tracing.sampling.probability: 1.0` &mdash; every request is sampled, not a
  10% slice, which has cost and volume implications of its own.
- `spring.jpa.properties.[hibernate.generate_statistics]: true` &mdash; Hibernate
  statistics collection carries a runtime cost.

None of this matters on a developer's own machine. It matters the moment
`peekaboot.enabled` resolves to `true` somewhere reachable by anyone else &mdash; see
[Security]({{ '/docs/security/' | relative_url }}) before that happens.
</div>
