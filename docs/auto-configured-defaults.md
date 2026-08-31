---
title: Auto-configured defaults
lead: What Peekaboot sets in your application by default, sourced from the YAML files and the detection logic that actually set it.
permalink: /docs/auto-configured-defaults/
---

Peekaboot doesn't only add its own dashboard &mdash; it also nudges a handful of Spring
Boot and library defaults toward full observability, so the dashboard has something to
show without you configuring Actuator, tracing sampling, or SQL logging by hand. Most of
these live in three YAML resources loaded by `PeekabootDefaultsEnvironmentPostProcessor`,
applied under different conditions; two further properties are set by that same
post-processor directly, not from a YAML resource &mdash; see [Actuator value
visibility](#actuator-value-visibility) below.

## Three files, three conditions

| File | Applied when | Purpose |
|---|---|---|
| `peekaboot-defaults.yml` | `peekaboot.enabled` resolves to `true` | Full observability &mdash; health/env/info exposure, 100% trace sampling, Hibernate statistics, verbose SQL and HTTP logging |
| `peekaboot-no-push-defaults.yml` | Always &mdash; even when Peekaboot is disabled | Stops the starter's bundled OTLP metrics registry from silently pushing to `localhost:4318` |
| `peekaboot-dev-toolbar-defaults.yml` | `peekaboot.enabled` **and** `peekaboot.dev-toolbar` both resolve to `true` | Shortens the span export delay so a trace is readable on the toolbar while the developer is still looking at the page |

All three are added via `environment.getPropertySources().addLast(...)`, and the
post-processor itself reports `Ordered.LOWEST_PRECEDENCE`. That means **any** property you
set &mdash; `application.yml`, a profile-specific file, an environment variable, a system
property, a `--command-line` argument &mdash; overrides an entry here. Nothing on this
page is a floor you have to work around; it's what applies when you haven't said
otherwise.

`peekaboot-defaults.yml` is skipped entirely while Peekaboot is disabled;
`peekaboot-no-push-defaults.yml` is not. This split exists because the starter puts
Micrometer's OTLP registry on the classpath regardless of whether Peekaboot itself is on,
and that registry pushes metrics on its own unless told not to &mdash; a risk that has
nothing to do with whether you actually want the dashboard. `peekaboot-dev-toolbar-defaults.yml`
is narrower still: `PeekabootDefaultsEnvironmentPostProcessor` checks `peekaboot.enabled`
first and returns immediately if it resolves `false`, before it ever looks at
`peekaboot.dev-toolbar` &mdash; so this file is only applied once *both* properties
resolve to `true`. An application that sets `peekaboot.dev-toolbar` explicitly, in either
direction, only decides this while `peekaboot.enabled` is also `true`; with Peekaboot
itself disabled, an explicit `peekaboot.dev-toolbar: true` has no effect on this file.

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
| `management.endpoint.health.show-details` | `never` | `always` | Shows per-component health detail (datasource, disk space, custom indicators) in the Overview tab's health banner instead of a bare UP/DOWN. |
| `management.info.env.enabled` | `false` | `true` | Publishes `info.*` properties (e.g. `info.app.*` set in your own `application.yml`) via `/actuator/info`, feeding the Overview tab &mdash; not OS/system environment variables, which the Environment tab already covers. |
| `management.info.java.enabled` | `false` | `true` | Exposes JVM vendor, version and runtime info in the Overview tab. |
| `management.info.os.enabled` | `false` | `true` | Exposes OS name, version and architecture in the Overview tab. |
| `management.info.process.enabled` | `false` | `true` | Exposes PID, uptime, CPU count and memory usage in the Overview tab. |
| `management.info.git.enabled` | `true` (unchanged) | `true` | Set explicitly for build traceability, even though it matches Spring Boot's own default &mdash; the source comment calls this out deliberately rather than relying on the implicit default. |
| `management.tracing.sampling.probability` | `0.1` (10%) | `1.0` (100%) | Samples every request so the Traces tab reflects everything, not a random 1-in-10 slice. |
| `management.observations.annotations.enabled` | `false` | `true` | Enables `@Observed`, `@Timed` and `@Counted` for declarative observability without extra wiring. |
| `decorator.datasource.datasource-proxy.format-sql` | `false` | `true` | Pretty-prints SQL in the Queries tab instead of a single unformatted line, for stacks whose JDBC spans carry `db.statement` or `jdbc.query[N]`. Only applies if `datasource-proxy` is on the classpath; see [Dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}#the-trace-view) for the full priority order `QueryExtractor` checks, including `db.query.text`, which this setting doesn't reach. |
| `decorator.datasource.datasource-proxy.query.log-level` | `DEBUG` | `TRACE` | Captures query logging at the more detailed level the dashboard's Queries view relies on. |
| `logbook.predicate.include[0].path` | all paths | `/api/**` | Scopes Logbook's HTTP request/response logging to API traffic, reducing noise from static assets and the dashboard's own endpoints. Only applies if Logbook is on the classpath. |
| `logbook.format.style` | `json` | `http` | Renders logged requests in a human-readable HTTP-message format rather than JSON. |
| `logbook.strategy` | `without-body` | `body-only-if-status-at-least` (with `minimum-status: 400`) | Logs response bodies only for error responses, keeping successful-request logging light while still capturing detail when something fails. |

## Actuator value visibility

`management.endpoint.env.show-values` and `management.endpoint.configprops.show-values`
are not in `peekaboot-defaults.yml`, and are not unconditional. They're set directly by
`PeekabootDefaultsEnvironmentPostProcessor`, in the same launch-context-detected property
source as `peekaboot.enabled` and `peekaboot.dev-toolbar` (see [How activation
works]({{ '/docs/how-activation-works/' | relative_url }})), and only on a local run.

| Property | Spring default | Peekaboot's default | Why |
|---|---|---|---|
| `management.endpoint.env.show-values` | `never` | `always`, on a local run only; unset otherwise | Left at Spring's default, the Environment tab would render `******` for every entry &mdash; `os.name` and `server.port` included &mdash; making the tab useless. Spring Boot 4.1 registers no default masking function, so `always` doesn't mean unmasked on Peekaboot's own dashboard/API surface (`/peekaboot/**`): Peekaboot's own masking engine runs over every value it hands back there, replacing what looks like a secret with `******` and leaving the rest readable. Off a local run the property isn't set at all, so Spring's own `never` masks every value &mdash; Peekaboot's masking engine never gets a real one to inspect. Peekaboot's masking engine does **not** run in front of Spring's own `/actuator/env`, though: if your application exposes that endpoint itself over HTTP, `show-values: always` widens it too, unmasked, on a local run. See [Security]({{ '/docs/security/' | relative_url }}#show-values-always-only-on-a-local-run). |
| `management.endpoint.configprops.show-values` | `never` | `always`, on a local run only; unset otherwise | Same reasoning, for the Config tab's bound `@ConfigurationProperties` values. |

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

## `peekaboot-dev-toolbar-defaults.yml`

Applied only once `peekaboot.dev-toolbar` itself resolves to `true` &mdash; on a local run
by default, or anywhere it's set explicitly.

```yaml
management:
  opentelemetry:
    tracing:
      export:
        schedule-delay: 200ms
```

| Property | Spring default | Peekaboot's default | Why |
|---|---|---|---|
| `management.opentelemetry.tracing.export.schedule-delay` | `5s` | `200ms` | How long Spring Boot's `BatchSpanProcessor` holds spans before handing them to the exporters, Peekaboot's own trace-store exporter among them &mdash; so this is the delay between a span ending and the toolbar being able to see it. Shortened so a trace is readable on the toolbar while the developer is still looking at the page. Only applied when the dev toolbar is on; a plain dashboard run keeps Spring's own `5s` default. |

<div class="pk-callout pk-callout--warning" markdown="1">
**Some of these widen what's exposed or what runs, beyond what a default Spring Boot app
would do:**

- `management.endpoint.health.show-details: always` &mdash; per-component health detail
  (datasource, disk, custom indicators) is always readable, not just the aggregate status.
- `management.endpoint.env.show-values: always` and
  `management.endpoint.configprops.show-values: always`, **on a local run only** &mdash;
  property *values* are readable through both endpoints there, kept at `always`
  deliberately even though Spring Boot 4.1 registers no default masking function of its
  own. On Peekaboot's own dashboard/API surface (`/peekaboot/**`) this doesn't leave those
  values unmasked: Peekaboot runs its own masking engine over every value it hands back
  there, on by default, independent of the `show-values` setting or any
  `SanitizingFunction` your application may or may not supply. Peekaboot registers no
  `SanitizingFunction` of its own, though, so if your application also exposes
  `/actuator/env` or `/actuator/configprops` over HTTP itself, *that* path is widened
  with no masking of any kind, on a local run &mdash; Peekaboot's masking engine never
  runs there. Off a local run neither property is set, so this widening doesn't happen
  and every value on Peekaboot's own Environment/Config tabs masks too. See [Security
  &mdash; `show-values: always` only on a local
  run]({{ '/docs/security/' | relative_url }}#show-values-always-only-on-a-local-run)
  for exactly what it catches, where it runs, and why.
- `management.info.env.enabled: true` &mdash; publishes `info.*` properties through
  `/actuator/info`, a separate exposure from the `show-values` masking above. This is
  not OS/system environment variables &mdash; those are what the Environment tab
  (`show-values` above) already covers.
- `management.tracing.sampling.probability: 1.0` &mdash; every request is sampled, not a
  10% slice, which has cost and volume implications of its own.
- `spring.jpa.properties.[hibernate.generate_statistics]: true` &mdash; Hibernate
  statistics collection carries a runtime cost.
- `management.opentelemetry.tracing.export.schedule-delay: 200ms`, once the dev toolbar
  is on &mdash; spans reach Peekaboot's trace store, and anything else reading the same
  `BatchSpanProcessor`, roughly 25 times more often than Spring's own default.

None of this matters on a developer's own machine. It matters the moment
`peekaboot.enabled` resolves to `true` somewhere reachable by anyone else &mdash; see
[Security]({{ '/docs/security/' | relative_url }}) before that happens.
</div>
