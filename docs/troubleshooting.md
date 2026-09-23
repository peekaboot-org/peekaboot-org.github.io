---
title: Troubleshooting
lead: Symptoms, their causes and the fix.
permalink: /docs/troubleshooting/
---

## `/peekaboot` returns 404 {#peekaboot-returns-404}

**Cause:** one of these.

| Cause | Fix |
|---|---|
| Peekaboot is off. It is off by default for `java -jar`, wars, native images, AOT builds, containers and tests. | Set `peekaboot.enabled=true` in `application.yml`, an environment variable or a system property. See [Configuration, when Peekaboot is on]({{ '/docs/configuration/' | relative_url }}#when-peekaboot-is-on). |
| You develop inside a devcontainer or GitHub Codespaces. Those count as containers. | Set `peekaboot.enabled=true` and the feature switches you want, such as `peekaboot.dev-toolbar`, explicitly. See [Configuration, container markers]({{ '/docs/configuration/' | relative_url }}#container-markers). |
| The application sets `server.servlet.context-path`. | Open the dashboard under that path, for example `/my-app/peekaboot`. The `/peekaboot` part cannot be changed. |
| The application is reactive (WebFlux) or not a web application. | None. Peekaboot's dashboard needs a servlet web application. |
| Spring Boot Actuator is not on the class path. | Keep `spring-boot-starter-actuator`, which the Peekaboot starter brings in. |

The startup log helps to tell these apart. Peekaboot logs a startup summary with the
application name, build, server and datasource details whenever it is on, unless you set
`peekaboot.lifecycle.enabled=false`. The summary's `Peekaboot Dashboard` line shows the URL,
and it is missing where no dashboard is served.

## Peekaboot is off in `@SpringBootTest` {#disabled-in-springboottest}

**Cause:** tests never count as a local run, so Peekaboot stays off in CI. See [Configuration,
what counts as a local run]({{ '/docs/configuration/' | relative_url }}#local-run).

**Fix:** switch it on for the test that needs it.

```java
@SpringBootTest(properties = "peekaboot.enabled=true")
```

## The Traces tab is empty {#traces-tab-empty}

**Cause:** nothing feeds the trace store. Check `tracingSpansPossible` in
`GET /peekaboot/api/features`.

| `tracingSpansPossible` | Cause | Fix |
|---|---|---|
| `false` | No OpenTelemetry SDK on the class path. | Keep `spring-boot-starter-opentelemetry`, which the Peekaboot starter brings in. See [Quick start]({{ '/docs/quick-start/' | relative_url }}#what-the-starter-brings). |
| `true` | Your configuration sets `management.tracing.sampling.probability` below `1.0`. Peekaboot's default of `1.0` loses to any value you set. | Check the effective value on the Environment tab and remove or raise your setting. |

A Traces tab that is missing altogether means `peekaboot.tracing.enabled=false`.

## Traces arrive late in tests {#traces-late-or-empty-in-tests}

**Cause:** spans are exported in batches. The delay is 200 ms while the dev toolbar is on and
Spring Boot's 5 s otherwise, and tests do not turn the toolbar on. A test that reads
`/peekaboot/api/traces/**` right after its request runs before the spans are there. Until they
are, `/peekaboot/api/traces/{traceId}/insights` answers `200` with `rootSpan: null`.

**Fix:** shorten the export delay in the test profile, or poll until `rootSpan` is set.

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

**Cause:** one of these.

- The dev toolbar is off. Logs are captured only while `peekaboot.dev-toolbar` is on.
- The application does not log through Logback. Capture works with Logback only.
- The log line was written on a thread without the trace context. Only lines that carry the
  trace id are kept. For `@Async` methods, see the next entry.

**Fix:** set `peekaboot.dev-toolbar: true`. See [Traces, what gets
captured]({{ '/docs/traces/' | relative_url }}#what-gets-captured).

## `@Async` work is missing or shows up as separate traces {#async-work-missing}

**Cause:** the trace context does not reach the executor thread. Spring Boot does not propagate
it by default, and Peekaboot does not switch that on for you.

**Fix:** enable context propagation.

```yaml
spring:
  task:
    execution:
      propagate-context: true
```

Also check that `peekaboot.tracing.async` and `peekaboot.tracing.enabled` are not set to
`false`. An application that declares its own `Executor` bean also needs
`spring.task.execution.mode=force`. See [Configuration,
`peekaboot.tracing`]({{ '/docs/configuration/' | relative_url }}#peekaboottracing) and [Traces,
background work]({{ '/docs/traces/' | relative_url }}#background-work).

## The toolbar does not appear {#toolbar-never-appears}

**Cause:** one of these.

- `peekaboot.dev-toolbar` is off. It is on only for a local run. Setting `peekaboot.enabled=true`
  does not switch it on.
- The response is not HTML with a `</body>` tag. JSON responses and redirects never get a bar.
- The HTML response is larger than 2 MB.
- The request matches an injection exclusion: an excluded path prefix, a blocked file
  extension, an `X-Requested-With` header or an async dispatch. See [Dev toolbar, where the
  bar appears]({{ '/docs/dev-toolbar/' | relative_url }}#where-the-bar-appears).

**Fix:** set `peekaboot.dev-toolbar: true` where you want the toolbar outside a local run.

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
See [The dashboard, conditionally shown
tabs]({{ '/docs/dashboard/' | relative_url }}#conditionally-shown-tabs).

## The Insights tab is missing or a panel says "No data" {#insights-tab-missing-or-no-data}

| Symptom | Cause | Fix |
|---|---|---|
| Insights tab missing | `peekaboot.insights.enabled=false`, or there is no `MeterRegistry` (Meters is missing too). | Remove the setting, or see [the Meters tab is missing](#meters-tab-missing). |
| Your panels are replaced by the default ones | Your `peekaboot-insights.yml` is invalid. The startup log has an `ERROR` containing `is invalid; discarding it entirely`. | Fix the file as the log message says. |
| A panel says "No data" | The panel's meters are not registered, for example there is no HikariCP, Hibernate or `datasource-micrometer`. | Look the meter up on the Meters tab. A meter that is not there cannot be charted. |

See [Insights, when the tab isn't there]({{ '/docs/insights/' | relative_url }}#when-the-tab-isnt-there).

## Values show as `******` {#values-show-as-asterisks}

**Cause:** Peekaboot masks values whose key or content looks like a secret. The rules can miss
a secret or mask a harmless value. See [Security, what gets masked, and
how]({{ '/docs/security/' | relative_url }}#what-gets-masked-and-how).

**Fix:** set `peekaboot.enable-unmasking: true`. Then use the "Show secrets" toggle on the
Environment and Config tabs, or add `?unmask=true` to `GET /peekaboot/api/actuator/all/insights`.
You need both. See [Security, two independent
opt-ins]({{ '/docs/security/' | relative_url }}#masking-opt-ins).

## The dashboard returns 401 {#dashboard-401}

**Cause:** Peekaboot runs outside a local run, and nothing it can detect protects
`/peekaboot/**`. Its own HTTP Basic guard is then on. It cannot see protection outside Spring
Security, such as a VPN, a proxy with basic auth, an IP allowlist or an API gateway.

This also hits smoke tests that start the packaged jar with Testcontainers or docker-compose.
That process counts as a deployment, not a test.

**Fix:** one of these.

- Use the user name and password from the `Peekaboot Security` block in the startup log.
- Set your own password with `peekaboot.security.password`.
- Set `peekaboot.security.enabled=false` where something else already protects the dashboard,
  or for the smoke-test container.

See [Security, securing the dashboard]({{ '/docs/security/' | relative_url }}#securing-the-dashboard).

## Users get a browser login dialog on application pages {#credential-dialog-on-toolbar-pages}

**Cause:** `peekaboot.dev-toolbar: true` is set in a deployed environment. The toolbar's
requests to `/peekaboot/api/**` get a `401` with an HTTP Basic challenge, and the browser asks
for credentials on whatever page is open.

**Fix:** remove `peekaboot.dev-toolbar: true` outside local development. It is off there by
default. See [Configuration, when Peekaboot is on]({{ '/docs/configuration/' | relative_url }}#when-peekaboot-is-on).

## The generated password changes on every restart {#password-changes-on-restart}

**Cause:** `peekaboot.storage.enabled` is `false`, the default outside a local run. The
generated password is not saved.

**Fix:** one of these.

- Set `peekaboot.storage.enabled=true` to keep the password across restarts.
- Set `peekaboot.security.password` to your own.
- Set `peekaboot.security.credentials-file` to a path. Peekaboot writes the credentials there
  even with storage off.

See [Configuration, `peekaboot.security`]({{ '/docs/configuration/' | relative_url }}#peekabootsecurity).

## Peekaboot's error page does not appear {#error-page-not-shown}

**Cause:** one of these.

- `peekaboot.error-page.enabled` is off. It is on only for a local run.
- The application has its own error page: an `error` view bean, an `error` template or a static
  `error/*.html`. Or it sets `spring.web.error.whitelabel.enabled=false`.
- The request does not accept `text/html`. API clients get the usual JSON error.

**Fix:** set `peekaboot.error-page.enabled: true` outside a local run. To show Peekaboot's page
in place of your own, set `peekaboot.error-page.override: true`, typically in your local
profile. The override does not work when the application excludes `ErrorMvcAutoConfiguration`
or maps its own `ErrorController` to `/error`. See [Configuration,
`peekaboot.error-page`]({{ '/docs/configuration/' | relative_url }}#peekabooterrorpage).

## Peekaboot's error page replaces your own {#error-page-replaces-own}

**Cause:** `peekaboot.error-page.override: true` is set. Without it, Peekaboot's page never
replaces an error page the application has.

**Fix:** remove `override`, or set it only in your local profile. To switch the page off
entirely, set `peekaboot.error-page.enabled: false`.

## Stack frames are hidden {#stack-frames-hidden}

**Cause:** stack-trace folding is on, the default for a local run. Framework frames collapse
behind a toggle on the error page and in the Logs tab. Your own frames are never folded.

**Fix:** click the toggle to expand them. To stop folding, set
`peekaboot.stack-trace.fold: false`. To change which frames fold, set
`peekaboot.stack-trace.exclude`. See [Configuration,
`peekaboot.stack-trace`]({{ '/docs/configuration/' | relative_url }}#peekabootstacktrace).
