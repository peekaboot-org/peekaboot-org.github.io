---
title: Troubleshooting
lead: Symptom, cause and fix for the failure modes that actually occur.
permalink: /docs/troubleshooting/
---

## `/peekaboot/` returns 404

**Cause:** Peekaboot is disabled. `peekaboot.enabled` resolves to `false` in a packaged jar, a
war, a native image, an AOT-processed build, a container or a test. See
[Configuration: when Peekaboot is on]({{ '/docs/configuration/' | relative_url }}#when-peekaboot-is-on).

**Fix:** Look for Peekaboot's application-ready summary in the startup log (application name,
build info, server and datasource info). No summary means Peekaboot never activated. Set
`peekaboot.enabled=true` explicitly, as an `application.yml` entry, an environment variable or a
system property. A summary that is there means the 404 has another cause.

The `/peekaboot` prefix is fixed, and no property moves it. A non-empty
`server.servlet.context-path` puts the dashboard under that path too (`/my-app/peekaboot/`), which
is the usual explanation when the summary shows Peekaboot running.

## The dashboard loads, but the Traces tab is empty

**Cause:** the tab is there, so the trace store exists. Nothing is filling it. Either there is no
Micrometer `Tracer` bean, or `management.tracing.sampling.probability` sits below `1.0` in a
property source of your own. Peekaboot defaults that probability to `1.0`, and anything you
configure outranks a Peekaboot default.

`peekaboot.tracing.enabled=false` is a different symptom. Without it there is no trace store, the
`tracing` feature flag is false, and the Traces tab is hidden rather than empty.

**Fix:** check the effective `management.tracing.sampling.probability` on the Environment tab, or
in your own property sources if the dashboard is unreachable. The `Tracer` and the OpenTelemetry
SDK that exports spans into the store both arrive with `spring-boot-starter-opentelemetry`, which
the Peekaboot starter brings in; exclude it and the store stays in place with nothing to fill it.
See [Quick start]({{ '/docs/quick-start/' | relative_url }}).

## The toolbar never appears

**Cause:** `peekaboot.dev-toolbar` is on for a
[local run]({{ '/docs/configuration/' | relative_url }}#local-run) and off elsewhere, detected
independently of `peekaboot.enabled`. Switching Peekaboot on deliberately in a shared environment
does not also inject the toolbar there. Even with it on, injection needs a response whose content
type contains `text/html` and whose body carries a `</body>` tag, so a JSON response or a redirect
never gets one.

**Fix:** Set `peekaboot.dev-toolbar: true` explicitly if you are off a local run, or if you turned
it off yourself. If it is already on and a page you expect still has no bar, check that response
against the remaining injection rules under [Dev toolbar, where the bar
appears]({{ '/docs/dev-toolbar/' | relative_url }}#where-the-bar-appears): excluded path
prefixes, an extension blocklist, the `X-Requested-With` header and async dispatch.

A bar that does appear but reads

```
Peekaboot toolbar could not start — sign in, or check that its script is allowed to load
```

is the opposite situation. Injection worked, and the script that fills the bar in was refused.
Either security in front of `/peekaboot/**` wants the reader to sign in, or a strict
`Content-Security-Policy` (a `script-src` that only honours nonces) is blocking the script
outright. For the latter, allow `/peekaboot/ui/toolbar/toolbar.js` in your `script-src`. See
[Security]({{ '/docs/security/' | relative_url }}#the-dev-toolbar-asks-the-reader-to-sign-in).

## Peekaboot is off inside `@SpringBootTest`

**Cause:** this is by design. A JUnit run under Maven Surefire or Gradle's test task can look like
a local launch on the surface, and Peekaboot treats it as not local anyway, so tests never carry
the dashboard, the toolbar and the observability defaults into CI. See
[Configuration: what counts as a local run]({{ '/docs/configuration/' | relative_url }}#local-run).

**Fix:** If a specific test needs Peekaboot active, set the property on that test:

```java
@SpringBootTest(properties = "peekaboot.enabled=true")
```

## Traces appear late, or are still empty, in tests

**Cause:** Spring Boot batches span export, 5 s by default. A test that queries
`/peekaboot/api/traces/**` immediately after making a request runs before the span has reached the
trace store, whether or not tracing itself works. While the spans are still in flight,
`/peekaboot/api/traces/{traceId}/insights` answers `200` with a null `rootSpan`, not `404`.

Peekaboot's own 200 ms export delay applies only when `peekaboot.enabled` resolves true, the
application is a servlet one, and `peekaboot.dev-toolbar` resolves true (see [Configuration: what
Peekaboot sets]({{ '/docs/configuration/' | relative_url }}#what-peekaboot-sets-in-your-application)).
Detection turns none of those on inside a test JVM, so a test profile that sets only
`peekaboot.dev-toolbar: true` still gets Spring's 5 s. Even 200 ms can be too slow for a test that
reads the trace store immediately.

**Fix:** Shorten the export delay for the test profile:

```yaml
management:
  opentelemetry:
    tracing:
      export:
        schedule-delay: 50ms
```

## The Meters tab is missing

**Cause:** the dashboard gates Meters on `GET /peekaboot/api/features` reporting `metrics: true`.
The flag is named `metrics`, the tab is named Meters. It reflects whether a Micrometer
`MeterRegistry` bean is present, which Spring Boot Actuator normally provides on its own.

**Fix:** Check what `GET /peekaboot/api/features` actually reports. If `metrics` is `false`,
something on your classpath or in your configuration is excluding Actuator's metrics
auto-configuration. The Insights tab and the Overview tab's stat-tile row need that same registry,
so they will be gone too. See [The dashboard: conditionally shown
tabs]({{ '/docs/dashboard/' | relative_url }}#conditionally-shown-tabs) and the [HTTP
API]({{ '/docs/api/' | relative_url }}).

## The Insights tab is missing, or a panel says "No data"

**Cause:** two different situations, and the tab itself tells you which. A **missing tab** means
`GET /peekaboot/api/features` reports `insights: false`, so either `peekaboot.insights.enabled` is
set to `false` or there is no `MeterRegistry` bean (in which case Meters is missing too). A panel
reading **"No data"** means the tab works and that panel's meters are not registered, because
there is no Hikari pool, no Hibernate, or no `datasource-micrometer` on the classpath. Panels stay
visible in that state on purpose, so an absent subsystem is something you can see.

A third case looks like the first. Your own `peekaboot-insights.yml` failed validation and was
dropped, so the tab shows the bundled defaults instead of your panels. That is always logged at
`ERROR` on startup; grep for `is invalid; discarding it entirely`.

**Fix:** For a missing tab, check `peekaboot.insights.enabled` and the `metrics` flag alongside
`insights`. For "No data" on a panel you expect data from, look the meter up on the Meters tab
first. If it is not in the registry, no series can resolve it. See
[Insights]({{ '/docs/insights/' | relative_url }}#when-the-tab-isnt-there).

## The Traces tab shows fewer queries than my endpoint actually issues, and carries a TRUNCATED badge

**Cause:** `peekaboot.tracing.max-spans-per-trace` (default `500`) caps a trace's span count after
duplicate folding, so folded duplicates never push a trace over it. Once the distinct span count
crosses the cap, the spans stored first are dropped at write time to make room for later ones. An
endpoint that really runs more than 500 distinct queries in one request loses whole queries before
they are counted, which undercounts the row's query stat. The trace is flagged `truncated` when
that happens, shown as a `TRUNCATED` badge, and the flag is never cleared. Without the badge the
count is not truncated, and a low number is the endpoint's real behaviour.

**Fix:** Raise `peekaboot.tracing.max-spans-per-trace`. See [Configuration: query-heavy
application]({{ '/docs/configuration/' | relative_url }}#query-heavy-application) for a worked
example.

## Values show as `******` and I need to see them

**Cause:** most likely this is the default. Peekaboot masks a value whose key name or whose shape
looks like a secret, wherever it shows one. The rules are key-name and value-shape matching, and
they are not exhaustive in either direction. Check a value against the exact list on [Security:
what gets masked, and how]({{ '/docs/security/' | relative_url }}#what-gets-masked-and-how)
whenever something you expected to be hidden is visible, or something you expected to read is
masked.

**Fix:** Set `peekaboot.enable-unmasking: true`, then use the "Show secrets" toggle that appears
on the Environment and Config tabs, or add `?unmask=true` to
`GET /peekaboot/api/actuator/all/insights`. Both are required, and the reveal reaches that one
endpoint only. See [Security: two independent
opt-ins]({{ '/docs/security/' | relative_url }}#two-independent-opt-ins-before-a-real-value-is-ever-shown).

## A trace has no logs

**Cause:** correlated logs are not a baseline tracing feature. They start flowing only once the
dev toolbar is on, and tracing being on (`peekaboot.tracing.enabled`, on by default) is not enough
by itself. Capture is Logback-only, and only events whose MDC carries the trace id are kept, so
anything logged on a thread the trace context never reached is dropped.

**Fix:** Set `peekaboot.dev-toolbar: true`. See [Traces: what gets
captured]({{ '/docs/traces/' | relative_url }}#what-gets-captured) for what turning it on adds
over what tracing alone already provides.

## My application sets `spring.jackson.*`

**Not a cause of anything:** Peekaboot's API responses and its insights stream are serialised with
Peekaboot's own mapper. A naming strategy, `non_null` inclusion or timestamp dates in your
application change nothing on the dashboard, and Peekaboot changes nothing in your own JSON.

## The dashboard started returning 401 after upgrading {#dashboard-401-after-upgrading}

**Cause:** this is a deployment launch, and nothing Peekaboot can see authenticates
`/peekaboot/**`, so Peekaboot's own guard has armed and is challenging requests with HTTP Basic.
Protection it cannot detect is invisible to it - a VPN, an nginx basic-auth layer, an IP
allowlist, an API gateway, any authentication that is not Spring Security putting an
authenticated principal on the request.

**Fix:** Use the credentials from the startup log's `Peekaboot Security` block, or set
`peekaboot.security.password` to one you choose, or set `peekaboot.security.enabled=false` where
the perimeter already covers it. See [Security: Securing the
dashboard]({{ '/docs/security/' | relative_url }}#securing-the-dashboard).

## A smoke test that boots the packaged jar started failing with 401 {#smoke-test-401}

**Cause:** a Testcontainers or docker-compose test that boots the packaged artifact starts it in
its own process, which Peekaboot reads as a deployment launch: the detection reads the stack of
the JVM Peekaboot itself runs in, and that JVM is not running a test, whatever the test
framework driving the container is.

**Fix:** Set `peekaboot.security.enabled=false` for that container, or supply
`peekaboot.security.password` and send it with the request. See [Configuration:
`peekaboot.security`]({{ '/docs/configuration/' | relative_url }}#peekabootsecurity).

## Users see a browser credential dialog on ordinary application pages {#credential-dialog-on-toolbar-pages}

**Cause:** the dev toolbar is explicitly on in a deployed environment
(`peekaboot.dev-toolbar: true`), and its own requests to `/peekaboot/api/**` answer `401` with
a `WWW-Authenticate: Basic` challenge. The browser turns that into a credential prompt on
whatever application page happens to be open, not only on the dashboard.

**Fix:** Leave `peekaboot.dev-toolbar` off outside local development, which is already the
default; this only happens where it was switched on explicitly. See [Configuration: when
Peekaboot is on]({{ '/docs/configuration/' | relative_url }}#when-peekaboot-is-on).

## The generated password is different after every restart {#password-changes-on-restart}

**Cause:** `peekaboot.storage.enabled` is `false` - the default outside local development - so
there is nowhere to write the credentials file, and the password Peekaboot generates on startup
does not survive a restart.

**Fix:** Set `peekaboot.storage.enabled=true` to keep the same password across restarts, or
`peekaboot.security.password` to fix one yourself, or `peekaboot.security.credentials-file` for
an explicit path written regardless of the storage switch. See [Configuration:
`peekaboot.security`]({{ '/docs/configuration/' | relative_url }}#peekabootsecurity).
