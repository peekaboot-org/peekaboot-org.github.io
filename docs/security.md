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

- **Environment values, on a local run.** Every property source Spring resolved, key and
  value, sourced from Actuator's `env` endpoint. See [Masking](#masking) below &mdash; by
  default, a value whose key or shape looks like a secret is replaced with `******`;
  everything else is shown verbatim. This is what a local run shows; off a local run every
  value masks, this rule set included &mdash; see [actuator value
  visibility](#show-values-always-only-on-a-local-run) below.
- **Config property values, on a local run.** Every value bound to a
  `@ConfigurationProperties` bean, from Actuator's `configprops` endpoint. Same masking,
  same caveat: it catches the common shapes, not everything &mdash; and the same
  local-run condition above applies here too.
- **Health detail.** Per-component status &mdash; datasource, disk space, custom
  indicators &mdash; not just an aggregate UP/DOWN. A custom `HealthIndicator`'s detail
  map is masked the same way as everything else &mdash; see [Masking](#masking).
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
  &mdash; captured verbatim from whichever tag your JDBC instrumentation populates
  (`db.query.text`, its superseded spelling `db.statement`, or `datasource-proxy`'s
  `jdbc.query[N]`, in that priority order &mdash; see [Auto-configured
  defaults]({{ '/docs/auto-configured-defaults/' | relative_url }})), literal values and
  all wherever the instrumentation or the statement itself carries them, not just the
  parameterized form &mdash; plus a basic method/path/status summary read off the root
  span. This part isn't gated by the dev toolbar; it's already served
  on the unauthenticated `/peekaboot/**` surface at stock local defaults. Once [the dev
  toolbar]({{ '/docs/dev-toolbar/' | relative_url }}) is also on
  (`peekaboot.dev-toolbar: true`), traces additionally carry request and response
  headers, query and form parameters, and the resolved controller/handler. Capture
  applies to every request that reaches
  [`RequestCaptureFilter`]({{ site.repository_url }}/blob/HEAD/peekaboot-backend/src/main/java/org/peekaboot/backend/filter/RequestCaptureFilter.java),
  not only the HTML pages the toolbar UI injects into &mdash; a JSON API call is captured
  the same way. Headers, query and form parameters are masked by key, the same as a
  property value; SQL text and span tags are masked only where a value-pattern rule
  recognises a credential shape inside them &mdash; see [Masking](#masking) for exactly
  what that does and doesn't catch.
- **Log message content**, once the dev toolbar is on (`peekaboot.dev-toolbar: true`).
  `PeekabootLogbackAppender` copies every log event your application emits, tagged with
  its trace/span id, into the trace's Logs tab &mdash; not just levels or logger names,
  the actual message content, unmodified, and **not masked at all**. A log statement that
  happens to include a secret or PII is captured exactly as written.
- **Metrics.** Every Micrometer meter's name, tags and measurements, read directly from
  the `MeterRegistry`. Tag values are masked the same way as everything else.

The dashboard's tabs are backed by `GET /peekaboot/api/actuator/all/insights`, which
invokes exactly seven Actuator endpoints
(`health`, `info`, `env`, `loggers`, `flyway`, `configprops`, `scheduledtasks` &mdash; see
[`PeekabootActuatorService`]({{ site.repository_url }}/blob/HEAD/peekaboot-backend/src/main/java/org/peekaboot/backend/service/PeekabootActuatorService.java)).
That's the whole actuator surface Peekaboot exposes over HTTP &mdash; see [HTTP
API]({{ '/docs/api/' | relative_url }}) for the full endpoint list.

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

Spring Boot's `env` and `configprops` endpoints normally mask values through a
`Sanitizer`, which runs whatever `SanitizingFunction` beans are present in the
application context. As of the Spring Boot version Peekaboot builds and ships against
(4.1), **Spring Boot itself does not register a default one** &mdash; an application has
to declare its own `@Bean SanitizingFunction` for any of that machinery to run at all.

Peekaboot doesn't rely on it. It ships its own masking engine
([`MaskingEngine`]({{ site.repository_url }}/blob/HEAD/peekaboot-backend/src/main/java/org/peekaboot/backend/masking/MaskingEngine.java),
package `org.peekaboot.backend.masking`) and applies it, on by default, everywhere a
value could carry a secret: `@ConfigurationProperties` values (Config tab), environment
property values (Environment tab), health indicator details, datasource connection
parameters, Micrometer meter tags, request and response headers, query and form
parameters on a captured trace, span tags, and SQL text. There's nothing to configure to
get this &mdash; it's the default, and it runs whether or not your application declares a
`SanitizingFunction` of its own.

### What gets masked, and how

Two independent rule sets, evaluated together, matching Spring's own masked-value literal
(`******`):

- **By key name.** A key is sensitive if it contains, as a whole separator- or
  camelCase-delimited token, one of: `password`, `passwd`, `pwd`, `passphrase`,
  `secret`, `client-secret`, `token`, `access-token`, `refresh-token`, `id-token`,
  `auth-token`, `bearer`, `credential`, `credentials`, `api-key`, `apikey`,
  `private-key`, `secret-key`, `signing-key`, `encryption-key`, `authorization`, `auth`,
  `session-id`, `salt`, `signature`, `certificate-password`, `certificate-private-key`
  &mdash; plus a handful of Spring Boot 2.x's own removed `Sanitizer` defaults
  (`vcap_services`, `^vcap\.services.*$`, `sun.java.command`,
  `^spring[._]application[._]json$`), matched as whole-key patterns. A sensitive key
  masks its **entire** value. Two narrower rules match only when they're the *entire*
  key, not merely a token inside it: `cookie` and `set-cookie` &mdash; they exist for
  the HTTP headers of the same name, not for the token "cookie" appearing anywhere in a
  compound key (a session-cookie configuration property like
  `server.servlet.session.cookie.same-site` is not a secret). One exact-key spelling is
  excluded outright despite matching a rule word: bare `PWD`/`pwd`, the POSIX shell's
  current-working-directory variable, which would otherwise collide with the `pwd`
  password abbreviation on every developer's environment-variables property source;
  `password`/`passwd` already cover the real password case in practice, and a compound
  key like `db.pwd` is unaffected by this exclusion. Deliberately absent: bare `key`
  and bare `certificate` &mdash; they would catch `spring.jpa.key-generator` and
  `server.ssl.key-store`/`server.ssl.certificate` (filesystem paths, not secrets), which
  is exactly the kind of over-masking that makes a dashboard useless. Actual certificate
  key material is still caught by the PEM value-shape pattern below regardless of the
  key it's stored under.
- **By value shape**, for a credential sitting inside a value under an otherwise
  innocuous key &mdash; a JDBC URL's `password=` parameter is the canonical case. A
  small set of high-precision, provider-prefixed patterns catches a JWT, a PEM private
  key block, an AWS/GitHub/GCP/Slack/Stripe/OpenAI/Anthropic key, and credentials
  embedded in a URL's userinfo (`user:pass@host`) or query string (`?password=...`).
  Only the matched span is masked, not the whole value, so a JDBC URL keeps its host and
  database name visible with just the credential blacked out.

Both rule sets are the full, exact list &mdash;
[`MaskingRules`]({{ site.repository_url }}/blob/HEAD/peekaboot-backend/src/main/java/org/peekaboot/backend/masking/MaskingRules.java)
is the single source of truth if you need to check whether a specific key or shape is
covered.

<div class="pk-callout pk-callout--warning" markdown="1">
**This is not exhaustive, and there is no entropy detection.** Key-name rules plus a
bounded set of value-shape patterns catch the common, recognisable cases; they cannot
catch a credential that has no recognisable shape sitting under a key that isn't listed
above &mdash; a literal in an ordinary-looking column (`INSERT INTO users (password)
VALUES ('hunter2')`) is not masked, because "hunter2" matches no provider pattern and the
SQL-text masking is value-shape-only, not column-aware. Entropy-based detection (flagging
any high-randomness string) was considered and deliberately rejected: it would destroy
legitimate values on screen &mdash; a git SHA, a UUID, a base64-encoded asset &mdash; and
documenting it as "secret detection" would recreate the exact overclaim this design
exists to avoid. Assume every captured trace can still contain plaintext SQL and
plaintext request data that this doesn't catch.
</div>

### Two independent opt-ins before a real value is ever shown

By default, masking cannot be turned off from the browser. Two things must both be true:

1. **`peekaboot.enable-unmasking`** (new property, default `false`). While `false`,
   there is no way &mdash; dashboard, API, or otherwise &mdash; to get an unmasked value
   out of Peekaboot.
2. **An `unmask=true` query parameter** on `GET /peekaboot/api/actuator/all/insights`.
   Without it, the endpoint masks, regardless of the property. With it, and *only* while
   the property above is also `true`, it returns real values. The parameter alone does
   nothing &mdash; it cannot be used as a bypass by itself.

The dashboard's Environment and Config tabs carry a "Show secrets" toggle that drives
the parameter, but only when `GET /peekaboot/api/features` reports `unmaskingEnabled:
true` &mdash; the control is absent from the page entirely, not merely disabled, when the
property is off, so the UI never offers a switch that can't work. See [The
dashboard]({{ '/docs/dashboard/' | relative_url }}#environment-vs-config) for what
toggling it does. Its state isn't persisted: reloading the page, or opening a new tab,
starts masked again.

### `show-values: always` only on a local run

`management.endpoint.env.show-values` and `.configprops.show-values` are set to `always`
only on a local run, at the same lowest-precedence, launch-context-detected property
source that resolves `peekaboot.enabled` and `peekaboot.dev-toolbar` (see [How activation
works]({{ '/docs/how-activation-works/' | relative_url }})) &mdash; not unconditionally,
and not from `peekaboot-defaults.yml`. Off a local run, neither property is set at all, so
Spring's own default (`never`) applies.

On a local run, this looks like exactly the setting that caused the original problem, and
an earlier version of this design called for removing it there too. It's kept, for a
structural reason: Spring Boot 4.1 registers no default `SanitizingFunction` regardless of
`show-values`, so falling back to Spring's own default would not hand masking over to
Spring &mdash; it would return `******` for *every* property unconditionally, including
harmless ones like `server.port`, and would leave Peekaboot's own masking engine with no
real value to ever inspect or, later, reveal. Controlled unmasking would then have nothing
to unmask either. `show-values: always`, on a local run, is what lets Peekaboot's own
engine see real values and decide, correctly, what to show.

<div class="pk-callout pk-callout--warning" markdown="1">
**Off a local run, every property masks &mdash; not just the ones that look like
secrets.** Peekaboot calls the same `env`/`configprops` endpoint beans in-process that
`show-values` governs (see [What Peekaboot does not do](#what-peekaboot-does-not-do)); with
the property unset, Spring's own `never` default makes those endpoint beans return
`******` for every value before Peekaboot's own masking engine ever sees a real one,
`server.port` included. Turning `peekaboot.enabled` on deliberately in a shared
environment does not widen what the dashboard's own Environment and Config tabs show: it
gets a dashboard, but those two tabs are masked outright there, the same as any other
Spring Boot application with `show-values` left at its default.
</div>

<div class="pk-callout pk-callout--warning" markdown="1">
**The accepted cost, confined to a local run:** on a local run, `show-values: always`
still widens your own application's `/actuator/env` and `/actuator/configprops`
endpoints, if you expose them over HTTP yourself, independently of Peekaboot &mdash;
Peekaboot's masking has no part in that path at all; it only ever runs inside Peekaboot's
own `/peekaboot/**` surface. Off a local run the property isn't set at all, so turning
`peekaboot.enabled` on in a shared environment does **not** widen those endpoints as a
side effect &mdash; Spring's own default governs them there, same as if Peekaboot weren't
installed. If you expose those actuator endpoints yourself and want them to stay masked
even on your own machine, set `management.endpoint.env.show-values` (and
`.configprops.show-values`) to `never` explicitly in your own configuration &mdash; that
overrides Peekaboot's lowest-precedence default.
</div>

### What's left unmasked entirely

- **Log message content**, wherever it's captured. Peekaboot's Logback appender copies
  whatever your logging statements produced, unmodified &mdash; there is no masking pass
  over log messages, by key or by shape.
- Anything a value-shape rule doesn't recognise and no key name catches &mdash; see the
  callout above.

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
- [ ] Leave `peekaboot.enable-unmasking` at its default (`false`) unless you specifically
      need to reveal real values from the dashboard &mdash; it's a server-side gate, not
      something a request parameter alone can bypass, but turning it on means anyone who
      can reach `/peekaboot/**` and add `?unmask=true` can too.
- [ ] Don't treat masking as complete. It catches known key names and known secret
      shapes (JWT, PEM, common cloud-provider key prefixes, credentials in a URL) &mdash;
      not an arbitrary secret with no recognisable shape, and not log message content at
      all. Assume every captured trace can still contain plaintext SQL and, with the dev
      toolbar on, plaintext headers and query/form parameters. Don't point Peekaboot at
      traffic carrying secrets you can't afford to have stored in memory and displayed.
- [ ] Leave `peekaboot.dev-toolbar` at its default (auto-detected: off outside a local
      run) unless you specifically need request/response capture &mdash; it's the setting
      that turns trace data from a method/path/status summary into full header and
      parameter capture. Production isn't a local run, so the default is already off
      there; don't set it explicitly unless you actually want that capture running.
