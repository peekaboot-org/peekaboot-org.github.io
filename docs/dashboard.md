---
title: The dashboard
lead: One tab per operational question &mdash; health, config, migrations, logs, schedules, metrics and traces.
permalink: /docs/dashboard/
---

The dashboard reads Actuator's `health`, `info`, `env`, `loggers`, `flyway`, `configprops`
and `scheduledtasks` endpoints in-process on every load &mdash; no
`management.endpoints.web.exposure` configuration needed, and nothing exposed on
`/actuator/**` itself. Metrics and Traces are fetched separately, from their own
endpoints, and are gated by feature flags rather than by that call &mdash; see the note at
the end of this page.

Tabs appear in this order, left to right.

## Dashboard

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-dashboard-light.png' | relative_url }}"
       alt="The Dashboard tab, showing Build, Git, Spring, Java, System, JVM Defaults and Datasource cards, plus memory meters and a health banner"
       loading="lazy">
</figure>

**Answers:** is the app healthy, and what's actually running?

Despite what older material says, there is no separate Health tab and no separate Info
tab &mdash; this one tab combines both. It carries build and Git metadata, Spring Boot and
Java versions, OS and JVM defaults, datasource status, memory and storage meters, and the
health banner with its per-component breakdown, all sourced from Actuator's `info` and
`health` endpoints.

## Environment

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-environment-light.png' | relative_url }}"
       alt="The Environment tab, listing property sources such as systemProperties, systemEnvironment and config resources, each expandable, with active profiles shown as a banner"
       loading="lazy">
</figure>

**Answers:** which property source wins for a given key, and why isn't my property taking
effect?

Every property source Spring resolved &mdash; command-line args, OS environment, JVM
system properties, `application.yml`, Peekaboot's own defaults, and the rest &mdash;
listed in resolution order, each expandable to its raw key/value pairs, with a filter and
the active profiles shown as a banner above them. Backed by Actuator's `env` endpoint.

## Flyway

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-flyway-light.png' | relative_url }}"
       alt="The Flyway tab, a table with one row per migration: version, description, script, type, duration, installed time and status"
       loading="lazy">
</figure>

**Answers:** which migrations ran, when, and did any fail?

One table row per migration &mdash; version, description, script name, type, duration,
install time, and status. Backed by Actuator's `flyway` endpoint; the tab only appears
when Flyway migrations exist.

## Loggers

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-loggers-light.png' | relative_url }}"
       alt="The Loggers tab, packages grouped and expandable, each logger showing its effective level, with totals and a filter for configured-only loggers"
       loading="lazy">
</figure>

**Answers:** what level is this logger actually running at, and is that an explicit
setting or a default?

Loggers grouped by package, filterable by name, with a checkbox to show only loggers that
carry an explicit configured level. This tab is read-only &mdash; it shows effective and
configured levels from Actuator's `loggers` endpoint, but the dashboard has no control to
change a level from here. The tab only appears when logger data is available.

## Config

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-config-light.png' | relative_url }}"
       alt="The Config tab, @ConfigurationProperties groups such as spring.mvc, spring.datasource and peekaboot.tracing, each expandable and filterable"
       loading="lazy">
</figure>

**Answers:** what is this component actually configured with?

Values bound to `@ConfigurationProperties` beans, grouped by prefix, filterable. Backed
by Actuator's `configprops` endpoint; the tab only appears when there's at least one
group to show.

### Environment vs Config

The two tabs look similar but answer different questions:

- **Environment** shows the *input*: every property source Spring knows about, in
  resolution order, with the raw value each source supplies. Use it to answer "which
  source wins for this key, and why isn't my property taking effect?" It also reveals
  properties nothing consumes &mdash; typos and dead config.
- **Config** shows the *output*: what the application actually uses. It lists the values
  bound to `@ConfigurationProperties` beans, grouped by prefix &mdash; after relaxed
  binding and type conversion, and including defaults set in Java code that never appear
  in any property source. Use it to answer "what is this component really configured
  with?"

A property set in `application.yml` that feeds a `@ConfigurationProperties` bean appears
in both; code defaults appear only under Config, and unconsumed or shadowed values appear
only under Environment. (`@Value` injections aren't covered by Config &mdash; look them
up under Environment.) The same split exists in Spring Boot Actuator itself, as `/env`
versus `/configprops`, which back these two tabs.

On a local run, both tabs mask sensitive values by default &mdash; a `password`-,
`secret`-, `token`- or similarly-named key renders as `******`, and a handful of
high-precision value patterns (a JWT, a PEM key block, a JDBC URL's embedded credential,
and similar) catch a secret hiding inside an otherwise innocuous value. This isn't Spring
Boot's own `Sanitizer` (as of the Spring Boot version Peekaboot ships against, 4.1, it
registers no default `SanitizingFunction` at all) &mdash; it's Peekaboot's own masking
engine, on by default, independent of anything your application configures.

Off a local run, both tabs mask *everything*, not just recognised secrets: value
visibility (`management.endpoint.env.show-values`/`.configprops.show-values`) is only set
to `always` on a local run, so off one, Spring's own `never` default returns `******` for
every property before Peekaboot's masking engine ever sees a real value &mdash;
`server.port` included. Turning `peekaboot.enabled` on somewhere other than your own
machine gets you the dashboard, but not readable values on these two tabs. See [Security
&mdash; `show-values: always` only on a local
run]({{ '/docs/security/' | relative_url }}#show-values-always-only-on-a-local-run).

Both tabs also carry a "Show secrets" toggle, visible only when
`GET /peekaboot/api/features` reports `unmaskingEnabled: true` &mdash; itself gated
behind the server-side `peekaboot.enable-unmasking` property, off by default. Toggling it
reveals real values for both tabs at once (they share one fetch of the same underlying
data), and the state isn't persisted across a reload.

<div class="pk-callout pk-callout--warning" markdown="1">
Masking here isn't exhaustive: it catches known key names and known secret shapes, not an
arbitrary secret with no recognizable pattern. See
[Security &mdash; masking]({{ '/docs/security/' | relative_url }}#masking) for exactly
what's covered, what isn't, and the two-opt-in design behind the toggle.
</div>

## Scheduled Tasks

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-scheduled-tasks-light.png' | relative_url }}"
       alt="The Scheduled Tasks tab, grouped into Cron Tasks, Fixed Delay Tasks and Fixed Rate Tasks, each expandable, with summary counts above"
       loading="lazy">
</figure>

**Answers:** what runs on a timer, and how is it scheduled?

`@Scheduled` methods grouped by schedule type &mdash; cron, fixed delay, fixed rate &mdash;
each expandable to its individual task rows. Backed by Actuator's `scheduledtasks`
endpoint; the tab only appears when at least one scheduled task exists.

## Metrics

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-metrics-light.png' | relative_url }}"
       alt="The Metrics tab, a filterable list of Micrometer meters such as application.ready.time, db.client.operation.duration and executor.pool.size, each with its type, unit and measurement count"
       loading="lazy">
</figure>

**Answers:** what do JVM, HTTP and datasource metrics look like right now?

Every meter in Micrometer's `MeterRegistry`, filterable by name or tag, each expandable to
its individual measurements. This is the one tab that doesn't go through Actuator at
all &mdash; it reads the registry directly.

## Traces

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-traces-light.png' | relative_url }}"
       alt="The Traces tab, a bucketed list of recent requests, scheduled jobs and other traces, each with a duration, status and query count, filterable by root action type"
       loading="lazy">
</figure>

**Answers:** what happened inside this request, job, or message?

Recent traces, bucketed into All, Errors and Slow, filterable by root action type and
root operation. Opening a row expands the full trace detail overlay &mdash; spans,
queries, logs and request metadata. See [Tracing]({{ '/docs/tracing/' | relative_url }})
and [Concepts]({{ '/docs/concepts/' | relative_url }}) for what the bucket names, badges
and root action types actually mean.

## Conditionally shown tabs

Loggers, Flyway, Config and Scheduled Tasks only appear once the dashboard's main payload
actually contains data for them &mdash; an app with no Flyway migrations simply has no
Flyway tab, for instance. Dashboard and Environment are always shown.

Metrics and Traces are different: they're gated on a separate call, `GET
/peekaboot/api/features`, which returns `{tracing, metrics, devToolbar,
unmaskingEnabled}`. Metrics needs a `MeterRegistry` bean, which Spring Boot Actuator
provides automatically; Traces needs tracing to be active (`peekaboot.tracing.enabled`, on
by default, plus an OpenTelemetry `SpanExporter` on the classpath). `unmaskingEnabled`
gates a control, not a tab &mdash; see [Environment vs Config](#environment-vs-config)
above. See [Requirements]({{ '/docs/requirements/' | relative_url }}) for the full
dependency picture.
