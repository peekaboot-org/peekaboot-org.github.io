---
title: The dashboard
lead: One tab per operational question, from health and live charts to migrations, loggers and schedules.
permalink: /docs/dashboard/
---

The dashboard calls Actuator in-process on every load. Peekaboot builds its own `info`,
`env`, `configprops`, `loggers`, `flyway` and `scheduledtasks` endpoint objects and reads
them in-process; only `health` is the application's own bean, kept available so
`management.endpoint.health.show-details` cannot strip the per-component breakdown. Either
way nothing is exposed on `/actuator/**`, and `management.endpoints.web.exposure` needs no
configuration. The same response also carries what Actuator does not produce: the Spring
Boot and framework versions, the datasource metadata, the JVM's own defaults, and the OS,
memory, storage, process and machine details behind Overview's cards. Insights,
Meters and Traces come from their own endpoints, gated by feature flags rather than by that
call.

"Dashboard" names the whole UI here, never one tab; the landing tab is **Overview**. Tabs
appear in this order, left to right.

## The header

The strip above the tabs is the same on every tab:

- **Updated &lt;time&gt;** is when the data on screen was fetched. The dashboard refetches
  every 30 seconds; **Refresh now** fetches immediately, and **Pause auto-refresh** stops
  the timer until pressed again. Traces, Lifecycle and Meters fetch from their own
  endpoints on the same cycle, and only while they are the tab on screen.
- **Timezone** is a **Browser**/**Server** toggle, with the zone it currently means beside
  it. Every timestamp is rendered in the chosen zone. Browser is the default, and the
  server's zone is the application's own.
- **Language** is EN, DE, FR or ES (`en-US`, `de-DE`, `fr-FR`, `es-ES`). It formats dates,
  times and numbers, and is sent to the API as `locale`, which localises the cron
  descriptions on Scheduled Tasks and the server's timezone name (see
  [HTTP API]({{ '/docs/api/' | relative_url }}#the-locale-parameter)). It defaults to the
  browser's language, which is added to the list when it is none of those four.
- **Theme** is light or dark; the toolbar and the trace-detail overlay follow it.

The Insights charts are the one thing the pause does not stop: they arrive over their own
live stream and keep updating while the timer is off. The Insights stat tiles on Overview
do ride the 30-second cycle, and stop with it.

Timezone, language and theme are remembered per browser, in `localStorage`
(`peekaboot-use-server-tz`, `peekaboot-locale`, `peekaboot-theme`). The Environment and
Config tabs' "Show secrets" toggle deliberately is not: a reload always starts masked.

### Deep links

Every view is a shareable URL. The hash carries the tab, the open trace and the filters,
so a location can be bookmarked or pasted into a chat:

- `#environment` opens that tab. The ids are `overview`, `insights`, `lifecycle`, `traces`,
  `meters`, `environment`, `flyway`, `loggers`, `config` and `scheduled-tasks`; anything
  else lands on Overview.
- `#traces/<traceId>` opens that trace's detail overlay on top of the Traces tab, on its
  Spans page. Append `/request`, `/spans`, `/queries` or `/logs` to land elsewhere.

A view's own filters travel as a query string, written as you type:

| View | Query string |
|---|---|
| Traces | `bucket`, `type`, `op` (`#traces?bucket=errors`). Without `type` the list shows every type except Connection Pool; selecting that chip writes `type=CONNECTION_POOL` |
| Meters, Environment, Config | `q`, the text filter (`#config?q=datasource`) |
| Loggers | `q` plus the configured-only checkbox (`#loggers?q=peekaboot&configured=1`) |
| Insights | `level`, the `percentiles` and `restarts` toggles, and `panels` for per-panel level overrides |
| Lifecycle | `page` |
| An open trace's Logs tab | `q`, `level` and `span` (`#traces/<traceId>/logs?level=WARN&q=timeout`) |

Switching tabs and opening a trace add history entries; changing a filter or the overlay's
own tab rewrites the URL in place. Back therefore closes the overlay or returns to the
previous tab instead of walking back through your filter edits. Closing the overlay drops
the trace from the hash, so a reload doesn't reopen it. An invalid bucket, level or page in
a link falls back to the default instead of filtering invisibly.

Theme, language and timezone stay [personal browser settings](#the-header) and never enter
a link: a shared URL doesn't impose the sender's display preferences on whoever opens it.

## Overview

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-overview-light.png' | relative_url }}"
       alt="The Overview tab, showing Build, Git, Spring, Java, System, JVM Defaults and Datasource cards, plus memory meters and a health banner"
       loading="lazy">
</figure>

**Answers:** is the app healthy, and what's actually running?

There is no separate Health tab and no separate Info tab; this one covers both. It carries
build and Git metadata, Spring Boot and Java versions, OS, machine and JVM defaults,
datasource status, memory and storage meters, and the health banner with its per-component
breakdown.
A composite contributor (Spring's `db` once there are two DataSources, or one of your own)
is one row with its aggregate status, followed by its children as `db/<name>`.

The Machine card is what the JVM actually got to run on: logical CPU count (plus the CPU
model on Linux), total physical memory, JVM max heap, and the container runtime. That last
one reads `docker`, `podman`, `kubernetes`, a generic `container` when only the cgroup
hierarchy gives the containment away, or `none`. CPU and memory come from the JDK, which is
container-aware: under container limits they report the container's share, not the host's.

It also lists the machine's non-local IP addresses under IPv4/IPv6 tabs (IPv4 first; a
family with no addresses hides its tab; up interfaces only; loopback and link-local
skipped), each with the hostname it reverse-resolves to when the lookup answers inside its
one-second budget. The CPU count is annotated with the physical topology: `8 (4 cores × 2
threads)` with SMT/hyper-threading active, `(4 cores, SMT off)` without, the plain count
where topology can't be read. Everything here is best-effort. What the machine won't reveal
is left out rather than guessed at.

The stat-tile row (Started at, Startup, Ready after, Uptime) comes from the insights
collector rather than Actuator, and is defined in the same file as the Insights panels. It
lives here because it answers an Overview question rather than a charting one. See
[Insights, stat tiles live on
Overview]({{ '/docs/insights/' | relative_url }}#stat-tiles-live-on-overview). With
insights off or unreachable (no `MeterRegistry`, `peekaboot.insights.enabled: false`, or
the call failing) the row is hidden outright rather than left as an empty box.

## Insights

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-insights-light.png' | relative_url }}"
       alt="The Insights tab, live line charts of CPU usage and system load with an aggregation level switch and toggles for percentiles and restart markers"
       loading="lazy">
</figure>

**Answers:** how have CPU, memory, HTTP, the connection pool and the rest behaved over the
last minutes, hours or days?

Live charts over a curated set of Micrometer meters, aggregated in-process at three
resolutions (10 seconds, 1 minute, 1 hour by default) and pushed to the browser over SSE
rather than polled. Panels for CPU, memory, threads, HTTP and the connection pool ship
enabled, more ship switched off ready to enable by id, and an application can add, replace or
hide panels with its own `peekaboot-insights.yml`.

[Insights]({{ '/docs/insights/' | relative_url }}) has the panel file's schema and merge
rules, what the levels cost in memory, and what the percentiles at those levels can and
can't honestly tell you.

## Lifecycle

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-lifecycle-light.png' | relative_url }}"
       alt="The Lifecycle tab, a table of application runs newest first with start, duration, stop, downtime and build columns, showing Running, Unclean exit and Deployment badges"
       loading="lazy">
</figure>

**Answers:** when did this application run, for how long, and what was deployed each time?

Every start and stop Peekaboot has recorded, turned into **runs**: one row per run, newest
first, 20 to a page. It is the table view of the same history the Insights charts draw
their restart markers from.

| Column | What it shows |
|---|---|
| Started | When the application became ready. The run in progress carries a **Running** badge |
| Ran for | How long it ran, with a **still counting** badge while that run is the current one |
| Stopped | When it shut down, or a dash and an **Unclean exit** badge, since a `kill -9`, a crash or a power loss records no stop |
| Down before | The gap between the previous run's stop and this one's start |
| Build | The version, with `branch @ commit` beneath it and the build time on hover. A run whose version, branch or commit differs from the one before it carries a **Deployment** badge naming which of the three changed |

A dash in this table always means *unknowable*, never zero: a run with no recorded stop has
no honest duration, and a run whose predecessor ended uncleanly has no stop to measure its
downtime from. Neither is guessed at.

How much history there is depends on
[`peekaboot.storage.enabled`]({{ '/docs/configuration/' | relative_url }}#peekabootstorage).
With it on, the default for a
[local run]({{ '/docs/configuration/' | relative_url }}#local-run), the log survives
restarts, up to the event cap stated there. With it off the tab shows the current run
alone, which is still a real row rather than an empty tab.

## Traces

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-traces-light.png' | relative_url }}"
       alt="The Traces tab, a bucketed list of recent traces with duration, status and query count, filterable by root action type"
       loading="lazy">
</figure>

**Answers:** what happened inside this request, job, or message?

Recent traces, bucketed into All, Errors and Slow, filterable by root action type and root
operation. The list asks for the 50 newest matches, so a bucket's count can be higher than
the number of rows under it. Opening a row expands the full trace detail overlay: spans,
queries, logs, and the whole HTTP exchange on a single Request page.
[Traces]({{ '/docs/traces/' | relative_url }}#root-action-type) has what the bucket names,
badges and root action types actually mean.

## Meters

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-meters-light.png' | relative_url }}"
       alt="The Meters tab, a filterable list of Micrometer meters, each with its type, unit and measurement count"
       loading="lazy">
</figure>

**Answers:** what do JVM, HTTP and datasource metrics look like right now?

Every meter in Micrometer's `MeterRegistry`, filterable by name or tag, each expandable to
its individual measurements. This is the one tab that doesn't go through Actuator at all.
It reads the registry directly.

Meters and Insights read the same registry and answer different questions. This tab is the
raw browser: every meter, its current measurements, nothing else. Insights charts a curated
subset of them *over time*. A meter you find here is exactly what you'd name in a
`peekaboot-insights.yml` series to start charting it.

## Environment

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-environment-light.png' | relative_url }}"
       alt="The Environment tab with a property source expanded, its values shown in full except spring.datasource.password, rendered as ******, with a Show secrets toggle above the list"
       loading="lazy">
  <figcaption class="has-text-grey is-size-7">Masked by default.</figcaption>
</figure>

**Answers:** which property source wins for a given key, and why isn't my property taking
effect?

Every property source Spring resolved (command-line args, OS environment, JVM system
properties, `application.yml`, Peekaboot's own defaults, and the rest) in resolution order,
each expandable to its raw key/value pairs, with a filter and the active profiles as a
banner above them. Backed by Actuator's `env` endpoint.

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-environment-revealed-light.png' | relative_url }}"
       alt="The same property source after clicking Show secrets: spring.datasource.password now rendered as sample_app_db_pwd instead of ******"
       loading="lazy">
  <figcaption class="has-text-grey is-size-7">Revealed, after
  <code>peekaboot.enable-unmasking</code> is on <em>and</em> Show secrets is clicked. See
  <a href="{{ '/docs/security/' | relative_url }}#masking">Security: masking</a> for the
  two-opt-in design and why this particular value is safe to publish.</figcaption>
</figure>

## Flyway

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-flyway-light.png' | relative_url }}"
       alt="The Flyway tab, one row per migration: version, description, script, type, duration, installed time and status"
       loading="lazy">
</figure>

**Answers:** which migrations ran, when, and did any fail?

One table row per migration: version, description, script name, type, duration, install
time, status. Backed by Actuator's `flyway` endpoint; the tab only appears when Flyway
migrations exist.

## Loggers

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-loggers-light.png' | relative_url }}"
       alt="The Loggers tab, packages grouped and expandable, each logger showing its effective level, with a filter for configured-only loggers"
       loading="lazy">
</figure>

**Answers:** what level is this logger actually running at, and is that an explicit setting
or a default?

Loggers grouped by package, filterable by name, with a checkbox for only those carrying an
explicit configured level. The tab is read-only: it shows effective and configured levels
from Actuator's `loggers` endpoint, and has no control to change one. It only appears when
logger data is available.

## Config

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-config-light.png' | relative_url }}"
       alt="The Config tab with the spring.datasource group expanded, its password rendered as ****** alongside real values for the other properties, with a Show secrets toggle above the list"
       loading="lazy">
</figure>

**Answers:** what is this component actually configured with?

Values bound to `@ConfigurationProperties` beans, grouped by prefix, filterable. Inside a
group, nested values are flattened to one row per leaf under its full dotted key
(`registration.google.client-secret` rather than one collapsed blob per bean), and list
entries are indexed, as in `servers[0]`. The filter matches those nested keys and the
values themselves, not just a group's top-level names. Backed by Actuator's `configprops`
endpoint; the tab only appears when there's at least one group to show.

### Environment vs Config

The two tabs look similar and answer different questions:

- **Environment** shows the *input*: every property source Spring knows about, in
  resolution order, with the raw value each supplies. It answers "which source wins for
  this key, and why isn't my property taking effect?" It also shows properties nothing
  consumes, which is how you find typos and dead config.
- **Config** shows the *output*: what the application actually uses, after relaxed binding
  and type conversion, including defaults set in Java code that never appear in any
  property source. It answers "what is this component really configured with?"

A property in `application.yml` that feeds a `@ConfigurationProperties` bean appears in
both; code defaults appear only under Config, unconsumed or shadowed values only under
Environment. `@Value` injections aren't covered by Config; look those up under Environment.
The same split exists in Actuator itself, as `/env` versus `/configprops`, which back these
two tabs.

Both tabs mask sensitive values by default, by key name and by value shape. This is
Peekaboot's own masking, independent of anything your application configures; your
`management.endpoint.*.show-values` settings do not apply to it. The rules are on the
security page: [what gets masked and
how]({{ '/docs/security/' | relative_url }}#what-gets-masked-and-how).

Both tabs carry a "Show secrets" toggle, present only when the server allows unmasking.
Toggling it reveals real values on both tabs at once, and the state isn't persisted across
a reload.

<div class="pk-callout pk-callout--warning" markdown="1">
Masking here isn't exhaustive. See
[Security, masking]({{ '/docs/security/' | relative_url }}#masking) for what's covered,
what isn't, and the two-opt-in design behind the toggle.
</div>

## Scheduled Tasks

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-scheduled-tasks-light.png' | relative_url }}"
       alt="The Scheduled Tasks tab, grouped into Cron Tasks, Fixed Delay Tasks and Fixed Rate Tasks, each expandable, with summary counts above"
       loading="lazy">
</figure>

**Answers:** what runs on a timer, and how is it scheduled?

`@Scheduled` methods grouped by schedule type (cron, fixed delay, fixed rate), each
expandable to its individual task rows. Backed by Actuator's `scheduledtasks` endpoint; the
tab only appears when at least one scheduled task exists.

## Conditionally shown tabs

Loggers, Flyway, Config and Scheduled Tasks appear only once the main payload contains data
for them. An app with no Flyway migrations has no Flyway tab. Overview, Lifecycle and
Environment are always shown. Lifecycle is deliberately among them rather than gated:
`peekaboot.lifecycle.enabled: false` removes its endpoint outright and the tab says so
instead of vanishing, on the grounds that whoever set that flag will not be puzzled by
it.

Insights, Meters and Traces are gated on a separate call, `GET /peekaboot/api/features`,
whose flags are `{tracing, tracingSpansPossible, metrics, devToolbar, unmaskingEnabled,
insights}`. It also carries the UI's duration thresholds and the mask literal; see
[HTTP API]({{ '/docs/api/' | relative_url }}). Meters needs a `MeterRegistry` bean, which
Spring Boot Actuator provides automatically. Insights needs that same bean plus
`peekaboot.insights.enabled` (on by default). Traces needs the in-memory trace store
(`peekaboot.tracing.enabled`, on by default): the tab is shown whenever the store is, and
without the OpenTelemetry SDK on the classpath it is empty rather than absent.
`unmaskingEnabled` gates a control, not a tab, as described under
[Environment vs Config](#environment-vs-config). See
[Quick start]({{ '/docs/quick-start/' | relative_url }}) for the full dependency picture.

Note the flag behind the Meters tab is named `metrics`, not `meters`.
