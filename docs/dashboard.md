---
title: The dashboard
lead: One tab each for health, live charts, run history, traces, meters, properties, migrations, loggers and schedules.
permalink: /docs/dashboard/
---

## Open the dashboard {#open-the-dashboard}

Open `/peekaboot` under your servlet context path, for example `http://localhost:8080/peekaboot`.
It redirects to `/peekaboot/ui/dashboard/index.html`. The landing tab is Overview.

The dashboard exists when all of these hold:

- `peekaboot.enabled` is on. It defaults to on for a
  [local run]({{ '/docs/configuration/' | relative_url }}#local-run) only.
- The application is a servlet web application.
- Spring Boot Actuator is on the classpath. The starter brings it.

You do not need to expose anything on `/actuator/**`. The dashboard works with no
`management.endpoints.web.exposure` setting, and `management.endpoint.health.show-details`
does not hide health components from it.

<div class="pk-callout pk-callout--warning" markdown="1">
The dashboard shows your configuration and environment. Read
[Security]({{ '/docs/security/' | relative_url }}#securing-the-dashboard) and
[Do I want this in production?]({{ '/docs/in-production/' | relative_url }}) before you turn
it on anywhere but your own machine.
</div>

## The header {#the-header}

The strip above the tabs is the same on every tab.

- **Updated &lt;time&gt;** shows when the data on screen was fetched. The dashboard refetches
  every 30 seconds. **Refresh now** fetches immediately. **Pause auto-refresh** stops the
  timer until you press it again. The Insights charts keep updating while paused.
- **Timezone** switches between **Browser** (the default) and **Server**. Every timestamp is
  shown in the chosen zone.
- **Language** is EN, DE, FR or ES. It formats dates, times and numbers, and localises the
  cron descriptions on Scheduled Tasks. It defaults to the browser's language, which is added
  to the list when it is none of the four.
- **Theme** is light or dark. The toolbar and the trace detail follow it.

Timezone, language and theme are remembered per browser.

## Share a view with a link {#deep-links}

The URL hash holds the tab, the open trace and the filters. Copy the address bar to share a
view.

- `#environment` opens that tab. The ids are `overview`, `insights`, `lifecycle`, `traces`,
  `meters`, `environment`, `flyway`, `liquibase`, `loggers`, `config` and `scheduled-tasks`.
  Any other id opens Overview.
- `#traces/<traceId>` opens that trace's detail on its Spans tab. Append `/request`,
  `/spans`, `/queries` or `/logs` to open another tab.
- `#traces/<traceId>/spans?root=<spanId>` opens one background task's own subtree of that
  trace.

Filters travel as a query string:

| View | Query string |
|---|---|
| Traces | `bucket`, `type` and `op` (`#traces?bucket=errors`). Without `type` the list shows every type except Maintenance. Unticking Maintenance under Excluded adds `excluded=none`. `type=MAINTENANCE` in a link is ignored |
| Meters, Environment, Config | `q`, the text filter (`#config?q=datasource`) |
| Loggers | `q` plus the configured-only checkbox (`#loggers?q=peekaboot&configured=1`) |
| Insights | `level`, the `percentiles` and `restarts` toggles, and `panels` for per-panel level overrides |
| Lifecycle | `page` |
| An open trace's Logs tab | `q`, `level` and `span` (`#traces/<traceId>/logs?level=WARN&q=timeout`) |

An invalid bucket, level or page in a link falls back to the default. Theme, language and
timezone are never part of a link.

## Overview {#overview}

{% include screenshot.html name="dashboard-overview" %}

Overview shows the application's health and what is running. It holds the health banner with
its per-component breakdown, build and Git metadata, Spring Boot and Java versions, OS and JVM
defaults, datasource status, and memory and storage meters. A composite health contributor,
such as Spring's `db` with two DataSources, shows as one row with its aggregate status,
followed by its children as `db/<name>`.

The Machine card shows the logical CPU count (with the CPU model on Linux), total physical
memory, the JVM's max heap, the machine's IPv4 and IPv6 addresses with their hostnames where these resolve, and
the container runtime: `docker`, `podman`, `kubernetes`, `container` or `none`. Inside a
container, CPU and memory show the container's limits.

### Stat tiles {#stat-tiles}

The row at the top shows Started at, Startup, Ready after and Uptime. Each tile shows a
current value only, with no history. Uptime updates on every refresh. The other three keep
their first value.

The tiles are defined in the Insights panel file, so you can replace them or add your own
there. See [Insights, tile fields]({{ '/docs/insights/' | relative_url }}#tile-fields).
The row is hidden when Insights is off or has no `MeterRegistry`.

## Insights {#insights}

{% include screenshot.html name="dashboard-insights" %}

Insights shows live charts of CPU, memory, threads, HTTP, the connection pool and more, over
the last minutes, hours or days. [Insights]({{ '/docs/insights/' | relative_url }}) covers
the default panels, adding your own, the memory cost and the limits of the percentiles.

## Lifecycle {#lifecycle}

{% include screenshot.html name="dashboard-lifecycle" %}

Lifecycle lists every run of the application, newest first, 20 to a page.

| Column | What it shows |
|---|---|
| Started | When the application became ready. The current run carries a **Running** badge |
| Ran for | How long it ran, with a **still counting** badge on the current run |
| Stopped | When it shut down. A `kill -9`, a crash or a power loss records no stop, so the cell shows a dash and an **Unclean exit** badge |
| Down before | The gap between the previous run's stop and this run's start |
| Build | The version, with `branch @ commit` beneath it and the build time on hover. A **Deployment** badge names which of the three changed since the previous run |

A dash means the value is unknown. A run with no recorded stop has no duration, and a run
after an unclean exit has no downtime.

History across restarts needs
[`peekaboot.storage.enabled`]({{ '/docs/configuration/' | relative_url }}#peekabootstorage),
on by default for a local run. Without it the tab shows the current run only. With
`peekaboot.lifecycle.enabled: false` the tab shows "Lifecycle history is unavailable".

## Traces {#traces}

{% include screenshot.html name="dashboard-traces" %}

Traces lists recent requests, jobs and messages in three buckets: All, Errors and Slow. You
can filter by root action type and root operation. The list shows the 50 newest matches, so
a bucket's count can be higher than the rows under it.

Click a row to open the trace detail with its spans, queries, logs and the HTTP exchange.
Background work started from a trace gets its own row. When the trace it ran under is still
stored, the row has a **View the trace this ran under** link.
[Traces]({{ '/docs/traces/' | relative_url }}) explains buckets, badges, root action types
and [background work]({{ '/docs/traces/' | relative_url }}#background-work).

## Meters {#meters}

{% include screenshot.html name="dashboard-meters" %}

Meters lists every meter in the Micrometer `MeterRegistry` with its current measurements,
filterable by name or tag. A meter name from this list is what you put in a
[panel file series]({{ '/docs/insights/' | relative_url }}#configuring-panels) to chart it on
Insights.

## Environment {#environment}

{% capture caption %}Masked by default.{% endcapture %}
{% include screenshot.html name="dashboard-environment" caption=caption %}

Environment lists every property source Spring resolved, in resolution order, with its raw
keys and values. Command-line arguments, OS environment, system properties,
`application.yml` and Peekaboot's own defaults all appear here. The active profiles are
shown above the list. Use it to find which source wins for a key.

{% capture caption %}Revealed, after <code>peekaboot.unmasking.enabled</code> is on <em>and</em> Show secrets is clicked. See <a href="{{ '/docs/security/' | relative_url }}#masking">Security: masking</a> for the two opt-ins and why this particular value is safe to publish.{% endcapture %}
{% include screenshot.html name="dashboard-environment-revealed" caption=caption %}

## Flyway {#flyway}

{% include screenshot.html name="dashboard-flyway" %}

Flyway shows one row per migration: version, description, script, type, duration, install
time and status.

## Liquibase {#liquibase}

Liquibase shows one row per change set in the order they ran, with the order, id, author,
change log, description, execution date and status. The status is `EXECUTED`, `FAILED`,
`SKIPPED`, `RERAN`, `MARK_RAN` or `UNKNOWN`, and a failed change set is highlighted. Change sets
from every Liquibase bean share one table. Liquibase records no duration.

## Loggers {#loggers}

{% include screenshot.html name="dashboard-loggers" %}

Loggers shows each logger's effective and configured level, grouped by package. You can
filter by name and show only loggers with an explicit level. The tab is read-only. It cannot
change a level.

## Config {#config}

{% include screenshot.html name="dashboard-config" %}

Config shows the values bound to `@ConfigurationProperties` beans, grouped by prefix. Nested
values get one row each under their full dotted key, such as
`registration.google.client-secret`, and list entries are indexed as `servers[0]`. The filter
matches these keys and their values.

### Environment vs Config {#environment-vs-config}

- **Environment** shows the input: every property source and the raw value each one supplies.
  It also shows properties nothing reads, which is how you find typos and dead config.
- **Config** shows what the application uses, after relaxed binding and type conversion. It
  includes defaults set in Java code, which appear in no property source.

A property in `application.yml` that feeds a `@ConfigurationProperties` bean appears in both.
`@Value` injections are not in Config. Look them up under Environment.

Both tabs mask sensitive values by key name and by value shape. Your
`management.endpoint.*.show-values` settings do not affect this. The rules are under
[what gets masked and how]({{ '/docs/security/' | relative_url }}#what-gets-masked-and-how).

The **Show secrets** toggle appears on both tabs only with unmasking enabled. See [Security, two
opt-ins before a real value is shown]({{ '/docs/security/' | relative_url }}#masking-opt-ins).
It reveals real values on both tabs at once and resets on reload.

<div class="pk-callout pk-callout--warning" markdown="1">
Masking is not exhaustive. See
[Security, masking]({{ '/docs/security/' | relative_url }}#masking) for what is covered and
what is not.
</div>

## Scheduled Tasks {#scheduled-tasks}

{% include screenshot.html name="dashboard-scheduled-tasks" %}

Scheduled Tasks lists `@Scheduled` methods grouped by type: cron, fixed delay and fixed rate.
Each group expands to its tasks. Cron expressions come with a description in the dashboard's
language.

## Which tabs appear {#conditionally-shown-tabs}

Overview, Lifecycle and Environment always appear. The others depend on your application:

| Tab | Shown when | Property |
|---|---|---|
| Insights | A Micrometer `MeterRegistry` bean exists | `peekaboot.insights.enabled` |
| Traces | The trace store exists. Without the OpenTelemetry SDK on the classpath the tab explains what to add instead of listing traces | `peekaboot.tracing.enabled` |
| Meters | A Micrometer `MeterRegistry` bean exists | none |
| Flyway | At least one Flyway migration exists | none |
| Liquibase | At least one Liquibase change set exists | none |
| Loggers | Logger data is available | none |
| Config | At least one `@ConfigurationProperties` group exists | none |
| Scheduled Tasks | At least one scheduled task exists | none |

Spring Boot Actuator provides the `MeterRegistry`. See
[Quick start]({{ '/docs/quick-start/' | relative_url }}) for the dependencies.

## Settings {#settings}

Every property is under [Configuration]({{ '/docs/configuration/' | relative_url }}#properties).
The table above names the switch behind each tab. The [issue
thresholds]({{ '/docs/configuration/' | relative_url }}#issue-thresholds) set the SLOW,
VERY_SLOW and SLOW_QUERY badges on Traces.
