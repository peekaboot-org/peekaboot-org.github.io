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

The `/peekaboot` prefix itself is fixed &mdash; there's no property to move it. If your
`server.servlet.context-path` is non-empty, the dashboard is under that context path too
(e.g. `/my-app/peekaboot/`), which is the most common cause of a 404 when the
application-ready summary shows Peekaboot is otherwise active.

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

**Cause:** `peekaboot.dev-toolbar` follows the same launch-context detection as
`peekaboot.enabled` &mdash; on for a local run, off elsewhere &mdash; not
`peekaboot.enabled` itself, so switching Peekaboot on deliberately in a shared environment
does not also inject the toolbar there. Off a local run (a packaged jar, a container, a
test), it defaults off; see [How activation works]({{ '/docs/how-activation-works/' | relative_url }})
for exactly what counts as local. Even with it on, the toolbar only injects into
responses whose content type is `text/html` and that actually contain a `</body>` tag; a
JSON API response, a redirect, or a static asset never gets it.

**Fix:** Set `peekaboot.dev-toolbar: true` explicitly if you're not on a local run, or if
you've turned it off yourself. If it's already on and the toolbar still doesn't show up
on a page you expect it on, confirm that page's response is genuinely HTML with a
`</body>` tag, and isn't one of the excluded paths (`/actuator/**`, `/peekaboot/**`,
`/webjars/**`, static assets) &mdash; see [Dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}).

## Peekaboot is off inside `@SpringBootTest`

**Cause:** this is by design, not a bug. A JUnit run under Maven Surefire or Gradle's test
task can look like a local launch on the surface, but Peekaboot treats it as not local
anyway, specifically so tests don't accidentally carry the dashboard, the toolbar, and the
observability defaults into CI. See [How activation works &mdash; why tests count as "not
local"]({{ '/docs/how-activation-works/' | relative_url }}#why-tests-count-as-not-local).

**Fix:** If a specific test needs Peekaboot active, set the property on that test:

```java
@SpringBootTest(properties = "peekaboot.enabled=true")
```

## Traces appear late, or are still empty, in tests

**Cause:** the OpenTelemetry SDK's `BatchSpanProcessor` batches and delays span export by
default &mdash; 5 seconds. A test that queries `/peekaboot/api/traces/**` immediately
after making a request can run before the span has actually reached Peekaboot's trace
store, independent of whether tracing itself is working. This doesn't apply if your test
profile sets `peekaboot.dev-toolbar: true` explicitly &mdash; detection alone never turns
it on inside a test JVM, see [Peekaboot is off inside `@SpringBootTest`](#peekaboot-is-off-inside-springboottest)
above &mdash; since Peekaboot's own dev-toolbar default then shortens the delay to 200ms
(see [Auto-configured defaults]({{ '/docs/auto-configured-defaults/' | relative_url }})),
though even that can be too slow for a test that reads the trace store immediately.

**Fix:** Shorten the export delay for the test profile:

```yaml
management:
  opentelemetry:
    tracing:
      export:
        schedule-delay: 50ms
```

## The Meters tab is missing

**Cause:** the dashboard doesn't show Meters unconditionally &mdash; it's gated on a
separate call, `GET /peekaboot/api/features`, reporting `metrics: true`. (The tab was
renamed from Metrics; the JSON flag behind it was not.) That flag reflects whether a
Micrometer `MeterRegistry` bean is present, which Spring Boot Actuator normally provides
automatically.

**Fix:** Confirm `GET /peekaboot/api/features` actually reports `metrics: true` (see
[The dashboard &mdash; conditionally shown
tabs]({{ '/docs/dashboard/' | relative_url }}#conditionally-shown-tabs) and [HTTP
API]({{ '/docs/api/' | relative_url }})); if it's `false`, something on your classpath or
in your configuration is excluding Actuator's metrics auto-configuration. The Insights tab
and the Overview tab's stat-tile row need that same registry, so they'll be gone too.

## The Insights tab is missing, or a panel says "No data"

**Cause:** two different situations, and the tab itself tells you which. A **missing tab**
means `GET /peekaboot/api/features` reports `insights: false` &mdash; either
`peekaboot.insights.enabled` is set to `false`, or there's no `MeterRegistry` bean (in
which case Meters is missing too). A panel reading **"No data"** means the tab is working
fine and that panel's meters simply aren't registered: no Hikari pool, no Hibernate, no
`datasource-micrometer` on the classpath. Panels stay visible in that state on purpose, so
an absent subsystem is something you can see.

A third case looks like the first: your own `peekaboot-insights.yml` failed validation and
was dropped, so the tab shows the bundled defaults instead of your panels. That is always
logged at `ERROR` on startup &mdash; grep for `Ignoring invalid insights panel config`.

**Fix:** For a missing tab, check `peekaboot.insights.enabled` and the `metrics` flag
alongside `insights`. For "No data" on a panel you expect data from, look the meter up on
the Meters tab first: if it isn't in the registry, no series can resolve it. See
[Insights]({{ '/docs/insights/' | relative_url }}#when-the-tab-isnt-there).

## The Traces tab shows fewer queries than my endpoint actually issues, and carries a TRUNCATED badge

**Cause:** `peekaboot.tracing.max-spans-per-trace` (default `500`) caps the
already-deduplicated span count for a trace; once a trace's real, distinct span count
crosses that cap, its **oldest** spans are dropped to make room for new ones, at write
time. An endpoint that genuinely runs more than 500 distinct queries in one request can
still lose whole queries before they're ever counted, which both undercounts query totals
and can suppress the `HIGH_QUERY_COUNT` warning on a trace that genuinely deserves it. The
trace is flagged `truncated` when this happens, shown as a `TRUNCATED` badge &mdash; if
you don't see that badge, the query count you're looking at isn't truncated, and a low
count reflects the endpoint's real behaviour, not the cap.

**Fix:** Raise `peekaboot.tracing.max-spans-per-trace`, not the query-count thresholds
below it &mdash; lowering those doesn't fix an undercount, it just makes the (still wrong)
number trigger a warning sooner. See [Configuration &mdash; `max-spans-per-trace`
deserves more than a table
row]({{ '/docs/configuration/' | relative_url }}#max-spans-per-trace-deserves-more-than-a-table-row)
for the full mechanics and a worked example.

## Values show as `******` and I need to see them

**Cause:** most likely, this is just the default. Peekaboot masks a value whose key or
shape looks like a secret on the Environment, Config, Overview (health detail) and
Meters tabs, and in captured trace headers, query/form parameters, span tags and SQL text
&mdash; see [Security &mdash; masking]({{ '/docs/security/' | relative_url }}#masking) for
the full list of what's covered.

If it's the Environment or Config tab specifically and **every** value is `******`, not
just ones that look like secrets, the likelier cause is different: you're off a local run.
`management.endpoint.env.show-values`/`.configprops.show-values` are only set to `always`
on a local run; off one, they're unset, Spring's own `never` default takes over, and the
underlying Actuator endpoint returns `******` for everything before Peekaboot's masking
engine ever sees a real value &mdash; see [Security &mdash; `show-values: always` only on
a local run]({{ '/docs/security/' | relative_url }}#show-values-always-only-on-a-local-run).
Setting `peekaboot.enable-unmasking` and using the toggle below does nothing for this case
&mdash; there's no real value behind the mask to reveal.

**Fix (recognisable-secret masking):** Set `peekaboot.enable-unmasking: true` on the
server, then use the "Show secrets" toggle that appears on the Environment and Config tabs
once that property is set (it's absent otherwise), or add `?unmask=true` to `GET
/peekaboot/api/actuator/all/insights` directly. Both are required &mdash; the property
alone changes nothing, and the request parameter alone is silently ignored while the
property is `false`. This only affects that one endpoint; headers, query parameters, span
tags, SQL and Micrometer meter tags (`/api/metrics`, which takes no `unmask` parameter at
all) stay masked unconditionally regardless of either setting. If a value you expected to
be masked isn't hidden at all, or a value you expected to be visible is masked and you
don't want it to be, check it against the exact key-name and value-shape rules in
[Security &mdash; what gets masked, and
how]({{ '/docs/security/' | relative_url }}#what-gets-masked-and-how) &mdash; masking is
rule-based, not exhaustive, in both directions.

**Fix (off a local run):** set `management.endpoint.env.show-values` and
`.configprops.show-values` to `always` yourself &mdash; an explicit setting wins over
Peekaboot's own detection either way &mdash; and only if you actually intend those two
tabs to show real values somewhere other than your own machine.

## A trace has no logs

**Cause:** correlated logs are not a baseline tracing feature. They only start flowing
once the dev toolbar itself is on &mdash; tracing being on (`peekaboot.tracing.enabled`,
on by default) is not enough by itself.

**Fix:** Set `peekaboot.dev-toolbar: true`. See [Tracing &mdash; what gets
captured]({{ '/docs/tracing/' | relative_url }}#what-gets-captured) for exactly what
turning it on adds versus what tracing alone already provides.
