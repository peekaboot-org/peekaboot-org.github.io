---
title: Troubleshooting
lead: Symptom, cause, fix &mdash; for the failure modes that actually occur.
permalink: /docs/troubleshooting/
---

## `/peekaboot/` returns 404

**Cause:** Peekaboot is disabled. `peekaboot.enabled` resolves to `false` in a packaged
jar, a war, a native image, an AOT-processed build, or a test &mdash; see [How activation
works]({{ '/docs/how-activation-works/' | relative_url }}) for exactly which of those
applies and why.

**Fix:** Check the startup log for Peekaboot's application-ready summary (application
name, build info, server and datasource info) &mdash; its absence confirms Peekaboot
never activated; its presence means the 404 has a different cause (a context path
prefix, for instance). If Peekaboot should be active here, set `peekaboot.enabled=true`
explicitly &mdash; as an `application.yml` entry, an environment variable, or a system
property.

## The dashboard loads, but the Traces tab is empty

**Cause:** one of three things: no Micrometer `Tracer` bean is present (the starter
provides one by default via `spring-boot-starter-opentelemetry`; you'd only lose it by
excluding that dependency), `peekaboot.tracing.enabled=false`, or
`management.tracing.sampling.probability` has been lowered below `1.0` somewhere in your
own configuration (Peekaboot's own default sets it to `1.0`, but any property source you
control overrides that).

**Fix:** Confirm a `Tracer` bean exists (see [Requirements]({{ '/docs/requirements/' | relative_url }})
for what depends on it), confirm `peekaboot.tracing.enabled` hasn't been set to `false`
(see [Configuration]({{ '/docs/configuration/' | relative_url }})), and check your
effective `management.tracing.sampling.probability` on the Environment tab if the
dashboard is otherwise reachable, or in your own property sources if it isn't.

## The toolbar never appears

**Cause:** `peekaboot.dev-toolbar` defaults to `false` &mdash; the toolbar is opt-in, not
a consequence of `peekaboot.enabled` alone. Even with it on, the toolbar only injects
into responses whose content type is `text/html` and that actually contain a `</body>`
tag; a JSON API response, a redirect, or a static asset never gets it.

**Fix:** Set `peekaboot.dev-toolbar: true`. If it's already set and the toolbar still
doesn't show up on a page you expect it on, confirm that page's response is genuinely
HTML with a `</body>` tag, and isn't one of the excluded paths (`/actuator/**`,
`/peekaboot/**`, `/webjars/**`, static assets) &mdash; see [Dev
toolbar]({{ '/docs/dev-toolbar/' | relative_url }}).

## Peekaboot is off inside `@SpringBootTest`

**Cause:** this is by design, not a bug. `LocalDevDetector` treats a JUnit run under
Maven Surefire or Gradle's test task as "not local" even when it otherwise looks like one
&mdash; same thread name, same class loader &mdash; specifically so tests don't
accidentally carry the dashboard, the toolbar, and the observability defaults into CI.
See [How activation works &mdash; why tests count as "not
local"]({{ '/docs/how-activation-works/' | relative_url }}#why-tests-count-as-not-local).

**Fix:** If a specific test needs Peekaboot active, set the property on that test:

```java
@SpringBootTest(properties = "peekaboot.enabled=true")
```

## Traces appear late, or are still empty, in tests

**Cause:** the OpenTelemetry SDK's `BatchSpanProcessor` batches and delays span export by
default &mdash; 5 seconds. A test that queries `/peekaboot/api/traces/**` immediately
after making a request can run before the span has actually reached Peekaboot's trace
store, independent of whether tracing itself is working.

**Fix:** Shorten the export delay for the test profile:

```yaml
management:
  opentelemetry:
    tracing:
      export:
        schedule-delay: 50ms
```

## The Metrics tab is missing

**Cause:** the dashboard doesn't show Metrics unconditionally &mdash; it's gated on a
separate call, `GET /peekaboot/api/features`, reporting `metrics: true`. That flag
reflects whether a Micrometer `MeterRegistry` bean is present, which Spring Boot Actuator
normally provides automatically.

**Fix:** Confirm `GET /peekaboot/api/features` actually reports `metrics: true` (see
[The dashboard &mdash; conditionally shown
tabs]({{ '/docs/dashboard/' | relative_url }}#conditionally-shown-tabs) and [HTTP
API]({{ '/docs/api/' | relative_url }})); if it's `false`, something on your classpath or
in your configuration is excluding Actuator's metrics auto-configuration.

## The Traces tab shows fewer queries than my endpoint actually issues

**Cause:** `peekaboot.tracing.max-spans-per-trace` (default `100`) truncates a trace's
**oldest** spans as new ones arrive, at write time &mdash; before span deduplication or
issue detection ever run. A query-heavy endpoint that emits more than 100 spans in one
request can lose whole queries before they're ever counted, which both undercounts query
totals and can suppress the `HIGH_QUERY_COUNT` warning on a trace that genuinely deserves
it.

**Fix:** Raise `peekaboot.tracing.max-spans-per-trace`, not the query-count thresholds
below it &mdash; lowering those doesn't fix an undercount, it just makes the (still wrong)
number trigger a warning sooner. See [Configuration &mdash; `max-spans-per-trace`
deserves more than a table
row]({{ '/docs/configuration/' | relative_url }}#max-spans-per-trace-deserves-more-than-a-table-row)
for the full mechanics and a worked example.

## A trace has no logs

**Cause:** correlated logs are not a baseline tracing feature. Peekaboot's Logback
appender, which tags each log event with the active trace/span id and feeds it into the
trace store, is registered only inside `DevToolbarAutoConfiguration` &mdash; the same
place that registers the request-capture filter. Both are conditional on
`peekaboot.dev-toolbar: true`; tracing being on (`peekaboot.tracing.enabled`, on by
default) is not enough by itself.

**Fix:** Set `peekaboot.dev-toolbar: true`. See [Tracing &mdash; what gets
captured]({{ '/docs/tracing/' | relative_url }}#what-gets-captured) for exactly what
turning it on adds versus what tracing alone already provides.
