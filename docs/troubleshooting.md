---
title: Troubleshooting
lead: Symptoms, their causes and the fix.
permalink: /docs/troubleshooting/
---

## `/peekaboot` returns 404 {#peekaboot-returns-404}

| Cause | Fix |
|---|---|
| Peekaboot is off. It is off by default for a deployment or a test. | Set `peekaboot.enabled=true` in `application.yml`, an environment variable or a system property. See [Configuration, when Peekaboot is on]({{ '/docs/configuration/' | relative_url }}#when-peekaboot-is-on). |
| You develop inside a devcontainer or GitHub Codespaces. Those count as containers. | Set `peekaboot.enabled=true` and the feature switches you want, such as `peekaboot.dev-toolbar.enabled`, explicitly. See [Configuration, containers]({{ '/docs/configuration/' | relative_url }}#container-markers). |
| The application sets `server.servlet.context-path`. | Open the dashboard under that path, for example `/my-app/peekaboot`. The `/peekaboot` part cannot be changed. |
| The application sets `spring.mvc.servlet.path`. | Open the dashboard under the DispatcherServlet's path, for example `/app/peekaboot/`. The startup summary prints the right URL. The `/peekaboot` part cannot be changed. |
| The application is reactive (WebFlux) or not a web application. | None. Peekaboot's dashboard needs a servlet web application. |
| Spring Boot Actuator is not on the classpath. | Keep `spring-boot-starter-actuator`, which the Peekaboot starter brings in. |

The startup summary's `Peekaboot Dashboard` line shows the URL. It is missing where no
dashboard is served, and the whole summary is missing with `peekaboot.lifecycle.enabled=false`.

## Peekaboot is off in `@SpringBootTest` {#disabled-in-springboottest}

**Cause:** a test never counts as a local run, so Peekaboot stays off in CI. See [Configuration,
what counts as a local run]({{ '/docs/configuration/' | relative_url }}#local-run).

**Fix:** switch it on for the test that needs it.

```java
@SpringBootTest(properties = "peekaboot.enabled=true")
```

## The Traces tab is empty {#traces-tab-empty}

Check `tracingSpansPossible` in `GET /peekaboot/api/features`. With it `false` the tab names
`org.springframework.boot:spring-boot-starter-opentelemetry` as the dependency to add.

| `tracingSpansPossible` | Cause | Fix |
|---|---|---|
| `false` | No OpenTelemetry SDK on the classpath. | Keep `spring-boot-starter-opentelemetry`, which the Peekaboot starter brings in. See [Production use]({{ '/docs/in-production/' | relative_url }}#class-path). |
| `true` | Your configuration sets `management.tracing.sampling.probability` to `0`, which beats Peekaboot's `1.0`. A value between `0` and `1` records only that share of requests. | Check the effective value on the Environment tab and remove or raise your setting. |

A Traces tab that is missing altogether means `peekaboot.tracing.enabled=false`.

## Traces from before a restart are gone {#traces-gone-after-restart}

| Cause | Fix |
|---|---|
| Storage is off. It is off for anything but a local run, or `peekaboot.storage.enabled=false` turns it off. | Set `peekaboot.storage.enabled=true`, or run from the IDE, with `mvn spring-boot:run` or with `gradle bootRun`. |
| `peekaboot.storage.traces.enabled=false`. | Remove it. |
| The log said `another running instance writes to <dir>`. | See [History is not saved although storage is on](#second-instance). |
| The log said `Peekaboot traces: the files in <dir> come from another Peekaboot version or start with a damaged header; starting without them`. | None. Peekaboot deleted them, and this run writes new ones. |
| The log said `Peekaboot traces: cannot write to <dir> (...); traces from here on will not survive a restart`. | Make the directory writable, or point `peekaboot.storage.dir` at one that is. |
| The log said `Peekaboot traces: the journal in <dir> stopped (...); traces from here on will not survive a restart`. | Give the JVM more heap or lower `peekaboot.tracing.max-traces`. The traces stay complete in memory. |
| The log said `Peekaboot traces: the journal could not keep up and dropped N inputs; they will not survive a restart`. | None. The journal fell behind a burst, or more than 10,000 inputs arrived before the application reported ready. The dropped inputs are missing after a restart only. |
| The log said `Peekaboot traces: skipped N unreadable lines in <dir>; restored the rest` or `Peekaboot traces: skipped N unreadable lines and M the store refused (...) in <dir>; restored the rest`. | None. Those lines are missing from the restored traces. |
| The log said `Peekaboot traces: cannot read <dir> (...); restored what was read before it`. | Check that the application can read the files in `<dir>`. What came after the failure was not restored. |
| The storage directory differs between the two runs. Without `build-info.properties` it comes from `spring.application.name`. | Set `peekaboot.storage.dir`, or generate `build-info.properties` in every build. See [Configuration, storage]({{ '/docs/configuration/' | relative_url }}#peekabootstorage). |
| The log said `Peekaboot traces: dropped N inputs that arrived while the stored traces were being restored`. | Inputs beyond 10,000 that arrived before the restore finished are lost. Repeat the requests you need. |
| The log said `Peekaboot traces: could not apply N inputs that arrived while the stored traces were being restored (...)`. | Report it with the exception in the parentheses. Those inputs are missing from their traces in this run. |
| The log said `Peekaboot traces: could not store span ... of trace ... (...); later failures are not logged`. | That span is missing from its trace. The parentheses name the cause. |

A trace that reads INTERRUPTED after a restart was still running when the application stopped.
One that holds spans but no root does not list on the Traces tab. Fetch it by id from
`/peekaboot/api/traces/{traceId}`, with an id from the [log
search]({{ '/docs/api/' | relative_url }}#log-search) for example.

## History is not saved although storage is on {#second-instance}

**Cause:** the startup log has `another running instance writes to <dir>`. That instance holds
the storage directory, so this one keeps its insights history, lifecycle log, traces, error
digest and generated password in memory only.

**Fix:** stop the other instance and restart this one, or set `peekaboot.storage.dir` to give
this one its own directory.

See [Configuration, storage]({{ '/docs/configuration/' | relative_url }}#peekabootstorage).

## The error digest is empty after a restart or misses a failure {#error-digest-gone}

The [error digest]({{ '/docs/api/' | relative_url }}#error-digest) survives a restart on the
same switches as the traces above.

| Cause | Fix |
|---|---|
| The log said `another running instance writes to <dir>`. | See [History is not saved although storage is on](#second-instance). |
| The log said `Peekaboot errors: <dir>/errors.jsonl comes from another Peekaboot version or starts with a damaged header; starting without it`. | None. Peekaboot deleted it, and a new file starts with the next recorded failure. |
| The log said `Peekaboot errors: cannot read <dir>/errors.jsonl (...); starting without it`. | Check that the application can read the file. |
| The log said `Peekaboot errors: skipped N unreadable lines in <dir>/errors.jsonl; restored the rest`. | None. Those entries are missing. |
| The log said `Peekaboot errors: cannot write <dir>/errors.jsonl (...); the error digest from here on will not survive a restart`. | Make the directory writable, or point `peekaboot.storage.dir` at one that is. |
| The log said `Peekaboot errors: cannot record trace <traceId> in the error digest (...); the digest misses it`. | Report it with the exception in the parentheses. The digest misses that failure. Its trace stays in the store. |

## Traces arrive late in tests {#traces-late-or-empty-in-tests}

**Cause:** spans arrive after a short delay. A test that reads `/peekaboot/api/traces/**` right
after its request sees none. Until the trace's root span arrives,
`/peekaboot/api/traces/{traceId}` answers `200` with `summary.complete` set to `false`.

**Fix:** shorten the [export
delay]({{ '/docs/configuration/' | relative_url }}#what-peekaboot-sets-in-your-application) in
the test profile, or poll until `summary.complete` is `true`.

```yaml
management:
  opentelemetry:
    tracing:
      export:
        schedule-delay: 50ms
```

## A trace shows a TRUNCATED badge or fewer queries than expected {#traces-tab-truncated}

**Cause:** the trace hit `peekaboot.tracing.max-spans-per-trace` (default `500`). The oldest
spans were dropped, and their queries with them. The badge stays on that trace. Without the
badge, the query count is complete.

**Fix:** raise `peekaboot.tracing.max-spans-per-trace`. See [Configuration, query-heavy
application]({{ '/docs/configuration/' | relative_url }}#query-heavy-application).

## A trace has no logs {#trace-has-no-logs}

| Cause | Fix |
|---|---|
| Tracing is off. Logs are captured only while `peekaboot.tracing.enabled` is on. | Remove `peekaboot.tracing.enabled: false`. |
| The application does not log through Logback. | None. Log capture works with Logback only. |
| The log line was written on a thread without the trace context. It is kept with the lines written outside any trace, the newest [`peekaboot.tracing.max-untraced-logs`]({{ '/docs/configuration/' | relative_url }}#peekaboottracing) of them. | Find it with `GET /peekaboot/api/logs?q=<text>`. For `@Async` and other executor work, see [the next entry](#async-work-missing). |

See [Traces, what gets recorded]({{ '/docs/traces/' | relative_url }}#what-gets-captured).

## `@Async` work is missing or shows up as separate traces {#async-work-missing}

{% include facts/propagate-context.md %}

Also check that `peekaboot.tracing.async` and `peekaboot.tracing.enabled` are not set to
`false`. An application that declares its own `Executor` bean also needs
`spring.task.execution.mode=force`. See [Traces, background
work]({{ '/docs/traces/' | relative_url }}#background-work).

## The toolbar does not appear {#toolbar-never-appears}

| Cause | Fix |
|---|---|
| `peekaboot.dev-toolbar.enabled` is off. It is on only for a local run, and `peekaboot.enabled=true` does not switch it on. | Set `peekaboot.dev-toolbar.enabled: true` where you want the toolbar. |
| The response is not HTML with a `</body>` tag. JSON responses and redirects never get a bar. | Open the request's trace on the Traces tab. Calls made from Swagger UI show in its bar. |
| The HTML response is larger than 2 MiB, or the request matches an injection exclusion: an excluded path prefix, a blocked file extension, an `X-Requested-With` header or an async dispatch. | Open the request's trace on the Traces tab, if it is traced. See [Dev toolbar, pages that get the bar]({{ '/docs/dev-toolbar/' | relative_url }}#where-the-bar-appears). |
| On a local run, the page was opened from another machine, or through a tunnel or a proxy. | See [The dashboard returns 403 on a local run](#dashboard-403). |

## The toolbar says "could not start" {#toolbar-could-not-start}

The bar reads:

```
Peekaboot toolbar could not start — sign in, or check that its script is allowed to load
```

**Cause:** the toolbar script was blocked. Either security in front of `/peekaboot/**` requires
a login, or a `Content-Security-Policy` with a nonce-only `script-src` refuses the script.

**Fix:** sign in to the dashboard, or allow `/peekaboot/ui/toolbar/toolbar.js` in your
`script-src`. See [Security, the dev toolbar asks the reader to sign
in]({{ '/docs/security/' | relative_url }}#toolbar-requires-sign-in).

## The Meters tab is missing {#meters-tab-missing}

**Cause:** there is no `MeterRegistry` bean. `GET /peekaboot/api/features` then reports
`metrics: false`. The Insights tab and the stat tiles on Overview are missing too.

**Fix:** find what excludes Spring Boot Actuator's metrics auto-configuration and remove it.
See [The dashboard, which tabs
appear]({{ '/docs/dashboard/' | relative_url }}#conditionally-shown-tabs).

## The Insights tab is missing or a panel says "No data" {#insights-tab-missing-or-no-data}

| Symptom | Cause | Fix |
|---|---|---|
| Insights tab missing | `peekaboot.insights.enabled=false`, or there is no `MeterRegistry`. | Remove the setting, or see [the Meters tab is missing](#meters-tab-missing). |
| Your panels are replaced by the default ones | Your `peekaboot-insights.yml` is invalid. The startup log has an `ERROR` containing `is invalid; discarding it entirely`. | Fix the file as the log message says. |
| A panel says "No data" | The panel's meters are not registered, for example there is no HikariCP, Hibernate or `datasource-micrometer`. | Look the meter up on the Meters tab. A meter that is not there cannot be charted. |

See [Insights, when the tab
appears]({{ '/docs/insights/' | relative_url }}#when-the-tab-appears).

## Liquibase dates are hours off on MySQL {#liquibase-dates-off-on-mysql}

**Cause:** MySQL stores `DATEEXECUTED` without a zone, so every date on the Liquibase tab is
off by the difference between the server's and the JVM's time zone.

**Fix:** have MySQL Connector/J read `DATETIME` as a timestamp in the server's zone, on that
DataSource:

```yaml
spring:
  datasource:
    hikari:
      data-source-properties:
        connectionTimeZone: SERVER
        treatMysqlDatetimeAsTimestamp: true
```

## Values show as `******` {#values-show-as-asterisks}

**Cause:** Peekaboot masks values whose key or content looks like a secret. The rules can miss
a secret or mask a harmless value. See [Security, what gets masked, and
how]({{ '/docs/security/' | relative_url }}#what-gets-masked-and-how).

**Fix:** set `peekaboot.unmasking.enabled: true`. Then use the "Show secrets" toggle on the
Environment and Config tabs, or add `?unmask=true` to `GET /peekaboot/api/actuator/all/insights`.
You need both. See [Security, two opt-ins before a real value is
shown]({{ '/docs/security/' | relative_url }}#masking-opt-ins).

## The dashboard returns 401 {#dashboard-401}

**Cause:** Peekaboot runs on a deployment, so its HTTP Basic guard is on. It challenges
every `/peekaboot/**` request, including one your own Spring Security chain signed in. A VPN,
a proxy with basic auth, an IP allowlist or an API gateway in front does not satisfy it.

This also hits smoke tests that start the packaged jar with Testcontainers or docker-compose.
That process counts as a deployment.

**Fix:** one of these.

- Use the username and the generated password from the `Peekaboot Security` block in the
  startup log. With storage on, only the first start prints the password. Later starts print
  `Password: unchanged since <date>`. If nobody kept it, delete the credentials file named on
  that line and restart for a new one.
- Set your own password with `peekaboot.security.password`.
- Set `peekaboot.security.enabled=false` where your own security protects the dashboard, and
  for a smoke-test container. If that security also uses the `Authorization` header, as HTTP
  Basic and bearer tokens do, the two lock each other out.

See [Security, securing the dashboard]({{ '/docs/security/' | relative_url }}#securing-the-dashboard).

## The dashboard returns 403 on a local run {#dashboard-403}

**Cause:** on a local run Peekaboot answers only the machine the application runs on. A request
from another machine gets a `403`. So does one a tunnel service or a reverse proxy relays, and
one that names the machine by anything but `localhost` or a loopback address. The response body
names `peekaboot.remote-access.enabled`.

**Fix:** one of these.

- Open an SSH tunnel to the machine's own `localhost`, then use
  `http://localhost:8080/peekaboot/` on yours:

  ```bash
  ssh -L 8080:localhost:8080 <host>
  ```

- Set `peekaboot.remote-access.enabled=true`. Anyone who can reach the port then reads the
  dashboard without signing in.

See [Security, who can reach Peekaboot]({{ '/docs/security/' | relative_url }}#who-can-reach-peekaboot).

## Users get a browser login dialog on application pages {#credential-dialog-on-toolbar-pages}

**Cause:** `peekaboot.dev-toolbar.enabled: true` is set in a deployed environment. The toolbar's
requests to `/peekaboot/api/**` get a `401` with an HTTP Basic challenge, and the browser asks
for credentials on whatever page is open.

**Fix:** remove `peekaboot.dev-toolbar.enabled: true` from the deployment. It is off there by default. See [Configuration, when Peekaboot is on]({{ '/docs/configuration/' | relative_url }}#when-peekaboot-is-on).

## The generated password changes on every restart {#password-changes-on-restart}

**Cause:** one of these.

- `peekaboot.storage.enabled` is `false`, the default on a deployment. The generated password
  is not saved.
- The log says the credentials file `is accessible to its group or to others` on every start.
  The file must be readable by its owner only, or Peekaboot ignores it.
- The log says `another running instance writes to <dir>`. See
  [History is not saved although storage is on](#second-instance).

**Fix:** one of these.

- Set `peekaboot.storage.enabled=true` to keep the password across restarts.
- Set `peekaboot.security.password` to your own.
- Set `peekaboot.security.credentials-file` to a path. Peekaboot writes the credentials there
  even with storage off. Choose a file system that keeps the file's mode.

See [Configuration, `peekaboot.security`]({{ '/docs/configuration/' | relative_url }}#peekabootsecurity).

## Peekaboot's error page does not appear {#error-page-not-shown}

**Cause:** one of these.

- `peekaboot.error-page.enabled` is off. It is on only for a local run.
- The application has its own error page, or sets `spring.web.error.whitelabel.enabled=false`.
  See [Error page]({{ '/docs/error-page/' | relative_url }}#own-error-page).
- {% include facts/error-page-accept.md %}

**Fix:** set `peekaboot.error-page.enabled: true` on a deployment. To show Peekaboot's page
in place of your own, set `peekaboot.error-page.override: true`, typically in your local
profile. See [Error page]({{ '/docs/error-page/' | relative_url }}#override).

## Peekaboot's error page replaces your own {#error-page-replaces-own}

**Cause:** `peekaboot.error-page.override: true` is set. Without it, Peekaboot's page never
replaces an error page the application has.

**Fix:** remove `override`, or set it only in your local profile. To switch the page off
entirely, set `peekaboot.error-page.enabled: false`.

## Stack frames are hidden {#stack-frames-hidden}

**Cause:** stack-trace folding is on, which is the default. Framework frames collapse
behind a toggle on the error page and in the Logs tab. Your own frames are never folded.

**Fix:** click the toggle to expand them. To stop folding, set
`peekaboot.stack-trace.fold: false`. To change which frames fold, set
`peekaboot.stack-trace.exclude`. See [Configuration,
`peekaboot.stack-trace`]({{ '/docs/configuration/' | relative_url }}#peekabootstacktrace).
