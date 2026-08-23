---
title: Security
lead: What Peekaboot actually exposes when it's on, what it doesn't touch, and how to run it without handing your application to whoever can reach it.
permalink: /docs/security/
---

<div class="pk-callout pk-callout--danger" markdown="1">
Peekaboot is off outside local development by default &mdash; see [How activation
works]({{ '/docs/how-activation-works/' | relative_url }}). When it's on, anyone who can
reach `/peekaboot/**` gets detailed internal state &mdash; configuration, environment
values, health, logs, migrations, and full request traces &mdash; with **no
authentication of any kind**. Peekaboot adds none of its own. If `/peekaboot/**` is
reachable by anyone other than you, either secure it first (see below) or don't turn it
on.
</div>

## What the dashboard and API expose

This is everything, not a curated subset. If you're deciding whether Peekaboot is safe to
enable somewhere, read all of it.

- **Environment values.** Every property source Spring resolved, key and value, sourced
  from Actuator's `env` endpoint. See [Masking](#masking) below &mdash; by default,
  **nothing is redacted**.
- **Config property values.** Every value bound to a `@ConfigurationProperties` bean,
  from Actuator's `configprops` endpoint. Same masking caveat.
- **Health detail.** Per-component status &mdash; datasource, disk space, custom
  indicators &mdash; not just an aggregate UP/DOWN.
- **Logger levels.** Every logger's configured and effective level, from Actuator's
  `loggers` endpoint. Peekaboot's own dashboard and API are read-only here &mdash;
  `PeekabootController` exposes no endpoint that writes a level, only
  [`GET` endpoints]({{ site.repository_url }}/blob/HEAD/peekaboot-backend/src/main/java/org/peekaboot/backend/controller/PeekabootController.java)
  &mdash; but the levels themselves, and which loggers have an explicit override, are
  fully visible.
- **Migration history.** Every Flyway migration's version, description, script name,
  type, duration, install time and status, from Actuator's `flyway` endpoint.
- **Request traces**, whenever [tracing]({{ '/docs/tracing/' | relative_url }}) is on
  (`peekaboot.tracing.enabled: true`, the default): every database query's SQL text
  &mdash; including the literal bound parameter values `datasource-proxy` inlines into
  it, not just the parameterized form &mdash; plus a basic method/path/status summary
  read off the root span. This part isn't gated by the dev toolbar; it's already served
  on the unauthenticated `/peekaboot/**` surface at stock local defaults. Once [the dev
  toolbar]({{ '/docs/dev-toolbar/' | relative_url }}) is also on
  (`peekaboot.dev-toolbar: true`), traces additionally carry request and response
  headers, query and form parameters, and the resolved controller/handler. Capture
  applies to every request that reaches
  [`RequestCaptureFilter`]({{ site.repository_url }}/blob/HEAD/peekaboot-backend/src/main/java/org/peekaboot/backend/filter/RequestCaptureFilter.java),
  not only the HTML pages the toolbar UI injects into &mdash; a JSON API call is captured
  the same way. See [Masking](#masking) for exactly what's redacted in this data and what
  isn't.
- **Log message content**, once the dev toolbar is on (`peekaboot.dev-toolbar: true`).
  `PeekabootLogbackAppender` copies every log event your application emits, tagged with
  its trace/span id, into the trace's Logs tab &mdash; not just levels or logger names,
  the actual message content, unmodified. A log statement that happens to include a
  secret or PII is captured exactly as written.
- **Metrics.** Every Micrometer meter's name, tags and measurements, read directly from
  the `MeterRegistry`.

### The raw actuator surface goes further than the dashboard tabs

The dashboard's tabs are backed by `GET /peekaboot/api/actuator/all/insights`, which
invokes exactly seven Actuator endpoints
(`health`, `info`, `env`, `loggers`, `flyway`, `configprops`, `scheduledtasks` &mdash; see
[`PeekabootActuatorService`]({{ site.repository_url }}/blob/HEAD/peekaboot-backend/src/main/java/org/peekaboot/backend/service/PeekabootActuatorService.java)).
A separate, equally unauthenticated endpoint, `GET /peekaboot/api/actuator/all/raw`,
invokes **every** Actuator endpoint bean present in your application except `heapdump`,
`threaddump` and `logfile` (excluded there only because they're expensive to run on
every request, not because they're sensitive). If your application has the `beans`,
`mappings`, `conditions`, `caches` or any other standard Actuator endpoint active, calling
that URL directly &mdash; nothing in the dashboard UI does, but nothing stops anyone else
&mdash; returns all of it. See [HTTP API]({{ '/docs/api/' | relative_url }}) for the full
endpoint list.

## What Peekaboot does not do

Peekaboot never exposes raw Actuator endpoints over HTTP. It builds its own
`WebEndpointDiscoverer` with empty endpoint filters and invokes each endpoint's read
operation in-process, from `PeekabootActuatorService`. No
`management.endpoints.web.exposure` configuration is needed for the dashboard to work,
and none is added by Peekaboot &mdash; the real `/actuator/**` HTTP mapping is completely
unaffected by anything Peekaboot does.

## The exposure contributor, precisely

Actuator endpoint beans are normally only created when
`@ConditionalOnAvailableEndpoint` is satisfied for *some* exposure technology &mdash; web
or JMX. With `management.endpoints.web.exposure.include` at Spring's default (`health`
only), most endpoint beans simply wouldn't exist, and Peekaboot's own in-process
discoverer would have nothing to invoke.

[`PeekabootEndpointExposureOutcomeContributor`]({{ site.repository_url }}/blob/HEAD/peekaboot-spring-boot-autoconfigure/src/main/java/org/peekaboot/autoconfigure/PeekabootEndpointExposureOutcomeContributor.java),
registered via `spring.factories`, plugs into that same condition and unconditionally
votes "exposed" for the web technology, for every endpoint, whenever `peekaboot.enabled`
is `true`. That's enough to make the endpoint *beans* exist.

It does **not** make them reachable over HTTP. Boot's own `WebEndpointDiscoverer` &mdash;
the one that actually feeds the `/actuator/**` HTTP mapping &mdash; applies
`management.endpoints.web.exposure.include`/`.exclude` independently, at a different
point, unaffected by this contributor. With Spring's defaults, that still leaves only
`/actuator/health` reachable over HTTP, at the same time the dashboard has full data on
everything else. The contributor's only effect is making endpoint beans exist for
Peekaboot's own private discoverer to call in-process; it does not touch what the regular
Actuator HTTP endpoint exposes.

## Masking

Spring Boot's `env` and `configprops` endpoints mask values through a `Sanitizer`, which
runs whatever `SanitizingFunction` beans are present in the application context. As of
the Spring Boot version Peekaboot builds and ships against (4.1), **Spring Boot itself
does not register a default one.** `SanitizingFunction` ships convenience methods &mdash;
`ifLikelySensitive()`, `ifLikelyCredential()`, and friends &mdash; that build a sensible
key-pattern-based function (keys ending in `password`, `secret`, `key`, `token`,
containing `credentials`, and a few other patterns), but nothing wires one of these up
automatically; an application has to declare its own `@Bean SanitizingFunction` for any
of it to run. This was confirmed by constructing `EnvironmentEndpoint` directly with an
empty `SanitizingFunction` list and `Show.ALWAYS` (Peekaboot's own default for
`show-values`): every property, including one named `spring.datasource.password`, came
back in plain text. Peekaboot registers no `SanitizingFunction` bean of its own.

<div class="pk-callout pk-callout--warning" markdown="1">
**With Peekaboot's defaults (`show-values: always`) and no `SanitizingFunction` bean of
your own, the Environment and Config tabs mask nothing.** Not "keys that don't look like
your custom secret" &mdash; nothing, including `password`- and `secret`-suffixed keys.
</div>

If you add a `SanitizingFunction` bean to your own application, Peekaboot's in-process
invocation honors it: `PeekabootActuatorService` discovers and calls the same endpoint
bean instances Spring Boot created for your application, it doesn't build its own copies,
so whatever sanitizer your beans assemble applies identically:

```java
@Bean
SanitizingFunction sanitizingFunction() {
    return SanitizingFunction.sanitizeValue().ifLikelySensitive();
}
```

The one thing Peekaboot masks on its own is a short, hardcoded list of HTTP headers in
captured request traces &mdash;
[`authorization`, `cookie`, `set-cookie`, `x-auth-token`, `x-api-key`]({{ site.repository_url }}/blob/HEAD/peekaboot-backend/src/main/java/org/peekaboot/backend/filter/RequestCaptureFilter.java),
replaced with `********`. This list is not configurable and has nothing to do with
Spring's `Sanitizer`.

Everything else is not masked, anywhere, under any configuration:

- Query and form parameters in a captured trace &mdash; a password submitted as a login
  form field, or an API key passed as a query parameter, is stored and shown verbatim.
- SQL text and the literal values bound into it, in the Queries tab.
- Any request or response header not in the five-item list above &mdash; a custom
  `X-Internal-Token` header, for instance, is not redacted.
- Log messages, wherever they're captured &mdash; Peekaboot's Logback appender copies
  whatever your logging statements produced, unmodified.

## Securing the dashboard

There's no built-in authentication to configure &mdash; only Spring Security in front of
the paths. This restricts `/peekaboot/**` to a specific role, using Spring Security's
lambda DSL:

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class PeekabootSecurityConfig {

    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    public SecurityFilterChain peekabootSecurityFilterChain(HttpSecurity http) throws Exception {
        return http
            .securityMatcher("/peekaboot/**")
            .authorizeHttpRequests(auth -> auth
                .anyRequest().hasRole("ADMIN")
            )
            .httpBasic(Customizer.withDefaults())
            .build();
    }
}
```

`securityMatcher("/peekaboot/**")` scopes this whole filter chain to Peekaboot's own
paths. When multiple `SecurityFilterChain` beans exist, Spring Security evaluates them in
ascending `@Order` order and uses the first whose `securityMatcher` matches &mdash;
**lower values are evaluated first**, the opposite of "falls through as a catch-all".
`@Order(Ordered.HIGHEST_PRECEDENCE)` above guarantees this chain is checked before any
other, so `/peekaboot/**` can't accidentally reach your application's general chain
first. Leave that general chain unordered (no `@Order` at all) so it defaults to
`Ordered.LOWEST_PRECEDENCE` and is evaluated last, as the catch-all &mdash; don't fold a
`/peekaboot/**` rule into it instead of using this one, and don't give it an `@Order`
lower than this chain's; either would let it match `/peekaboot/**` first and silently
bypass the restriction this page just told you to add. Swap `httpBasic` for whatever your
application already uses (form login, OAuth2, a gateway-issued header) &mdash; the part
that matters is `.hasRole(...)` (or `.authenticated()`, if any logged-in user should be
trusted with this data) actually gating `/peekaboot/**`.

## Running it in a deployed environment

If you have a genuine reason to run Peekaboot somewhere other than your own machine
&mdash; a shared staging environment, say &mdash; set `peekaboot.enabled=true` explicitly
(see [How activation works]({{ '/docs/how-activation-works/' | relative_url }})) and put
the `SecurityFilterChain` above in front of it before anything else. Restricting network
reachability as well &mdash; an internal-only ingress rule, a VPN, a sidecar that only
proxies `/peekaboot/**` from trusted sources &mdash; is worth doing in addition to
authentication, not instead of it. Whoever your authentication boundary now admits has
read access to everything in [What the dashboard and API
expose](#what-the-dashboard-and-api-expose); choose the role or group you gate on with
that in mind, not just "logged in."

## Keeping it out of production entirely

If Peekaboot should never ship in a production artifact regardless of what
`peekaboot.enabled` resolves to, exclude the starter at packaging time. See [How
activation works &mdash; keeping the jar out of production
builds]({{ '/docs/how-activation-works/' | relative_url }}#keeping-the-jar-out-of-production-builds)
for the full Maven `excludes` and Gradle `developmentOnly` examples.

## Production checklist

- [ ] Don't rely on the default. Verify `peekaboot.enabled` actually resolves to `false`
      in your deployed environment &mdash; check the startup summary, or the value
      reported on the dashboard's own Environment tab in a non-production environment
      where you can still reach it.
- [ ] If Peekaboot should never ship at all, exclude the starter from the production
      artifact (Maven `excludes` / Gradle `developmentOnly`) rather than trusting
      `peekaboot.enabled=false` alone.
- [ ] If you do turn it on somewhere reachable, put a `SecurityFilterChain` in front of
      `/peekaboot/**` first &mdash; not after.
- [ ] Don't reach for `management.endpoints.web.exposure` as a protection here; it
      governs `/actuator/**`, a mapping Peekaboot doesn't use or widen.
- [ ] Register your own `SanitizingFunction` bean if you need environment and config
      values masked. Peekaboot doesn't add one, and Spring Boot no longer does either.
- [ ] Assume every captured trace contains plaintext SQL &mdash; and, with the dev
      toolbar on, headers and query/form parameters too. Don't point Peekaboot at
      traffic carrying secrets you can't afford to have stored in memory and displayed.
- [ ] Leave `peekaboot.dev-toolbar` at its default (`false`) unless you specifically need
      request/response capture &mdash; it's the setting that turns trace data from a
      method/path/status summary into full header and parameter capture.
