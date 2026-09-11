---
title: Security
lead: Everything Peekaboot exposes while it is on, and how to put a lock in front of it.
permalink: /docs/security/
---

<div class="pk-callout pk-callout--danger" markdown="1">
Peekaboot defaults to on for a [local run]({{ '/docs/configuration/' | relative_url }}#local-run).
That covers an IDE run, `spring-boot:run`, `bootRun`, and any launch of your build output on
a host that is not a container. It defaults to off for a `java -jar` of the packaged jar, a
war, a native image, a test, and anything in a container, an image shipping
`spring-boot-devtools` included. On a local run `/peekaboot/**` carries detailed internal state
(configuration, environment values, health, logs, migrations, full request traces) with **no
authentication of any kind** - Peekaboot's own guard is off there too. Outside local
development, turning it on arms a fallback guard automatically (see [Securing the
dashboard](#securing-the-dashboard)), but that is a stop-gap, not a substitute for securing it
yourself. If `/peekaboot/**` is reachable by anyone other than you, secure it first or leave it
off.
</div>

## What the dashboard and API expose {#what-the-dashboard-and-api-expose}

This is everything, not a curated subset. If you are deciding whether Peekaboot is safe to
enable somewhere, read all of it.

- **Environment values.** Every property source Spring resolved, key and value, read
  through Actuator's `env` endpoint machinery. A value whose key or shape looks like a
  secret is replaced with `******` and everything else is shown verbatim (see
  [Masking](#masking)). That holds wherever `peekaboot.enabled` is `true`, on a local run
  or off one; your own `management.endpoint.env.show-values` setting plays no part (see
  [Actuator's `show-values` does not apply](#show-values-does-not-apply)).
- **Config property values.** Every value bound to a `@ConfigurationProperties` bean, from
  Actuator's `configprops` endpoint. Same masking, same independence from
  `management.endpoint.configprops.show-values`.
- **Health detail.** Per-component status (datasource, disk space, custom indicators), not
  just an aggregate UP/DOWN. A custom `HealthIndicator`'s detail map is masked the same way
  as everything else.
- **Process identity.** The OS user the JVM runs as, its uid and gid, its pid, and the
  parent-process chain as far up as the JVM can see, with every ancestor's pid and command
  name. Shown on the Overview tab. None of it is masked.
- **Machine facts.** The logical processor count, the total physical memory, the JVM's max
  heap, the container runtime Peekaboot detected (`docker`, `podman`, `kubernetes`, a
  generic `container`, or `none`), and on Linux the CPU model name and physical topology.
  It also carries the machine's non-local IP addresses, IPv4 and IPv6, and the hostname each
  one reverse-resolves to where that lookup succeeds. Served as `runtime.machine` on
  `GET /peekaboot/api/actuator/all/insights` and shown on the Overview tab. None of it is
  masked, network addresses included.
- **Datasource metadata.** For every `DataSource` bean, its host or hosts and port, database
  name, the database user, the database product and version, and the JDBC driver's name,
  read from the connection's `DatabaseMetaData`. Only the JDBC URL's connection
  parameters go through masking. The user name, host and database name are shown verbatim.
- **Scheduled tasks' last failure.** For every `@Scheduled` task, alongside its schedule and
  last and next execution time, the last execution's exception type and message exactly as
  Actuator's `scheduledtasks` endpoint reports it, **not masked**. An exception message that
  echoes a connection string or a payload is captured as is.
- **Run history**, through `/peekaboot/api/lifecycle/**`. Every start and stop Peekaboot has
  recorded, with the version, branch, commit and build time that was running each time, the
  timestamps, and which runs ended uncleanly. That is this instance's deployment history, as
  far back as the log reaches (see [What Peekaboot writes to
  disk](#what-peekaboot-writes-to-disk)). Nothing here is masked.
- **Logger levels.** Every logger's configured and effective level, from Actuator's
  `loggers` endpoint. Peekaboot's API is GET-only, so nothing here can change a level. The
  levels themselves, and which loggers carry an explicit override, are fully visible.
- **Migration history.** Every Flyway migration's version, description, script name, type,
  duration, install time and status, from Actuator's `flyway` endpoint.
- **Request traces**, whenever [tracing]({{ '/docs/traces/' | relative_url }}) is on
  (`peekaboot.tracing.enabled: true`, the default). Every database query's SQL text, taken
  verbatim from whichever tag your JDBC instrumentation populates (`db.query.text`, its
  superseded spelling `db.statement`, or `datasource-proxy`'s `jdbc.query[N]`, in that
  priority order, see [the trace
  view]({{ '/docs/dev-toolbar/' | relative_url }}#the-trace-view)). Literal values come with
  it wherever the instrumentation or the statement carries them, not only the parameterized
  form. With it, the full span tree of every trace: each span's name, kind, timing, tags
  (`http.url`, `db.statement`, `handler.name`, `view.name`, whatever your instrumentation
  sets) and error message, plus a method/path/status summary read off the root span. None of
  this is gated by the dev toolbar; it is already served on the unauthenticated
  `/peekaboot/**` surface at stock local defaults. Once [the dev
  toolbar]({{ '/docs/dev-toolbar/' | relative_url }}) is also on
  (`peekaboot.dev-toolbar: true`), traces additionally carry request and response headers,
  query and form parameters, the resolved controller and handler, and the correlated logs
  described next. Capture applies to every request, not only the HTML pages the toolbar
  injects into. Headers and parameters are masked by key, like a property value; SQL text,
  span tags and span error messages only where a value shape recognises a credential inside
  them. Read [Masking](#masking) for what that does and does not catch.
- **Log message content**, once the dev toolbar is on (`peekaboot.dev-toolbar: true`).
  Peekaboot copies every log event your application emits inside a trace, tagged with its
  trace and span id, into that trace's Logs tab. Not just levels and logger names, the
  actual message content, unmodified, and **not masked at all**. A log statement that
  happens to include a secret or PII is captured exactly as written. A log line emitted
  outside a trace is dropped rather than stored.
- **A trace id on the responses Peekaboot captures.** With the dev toolbar on, tracing on
  and a span in flight, Peekaboot adds a
  `Server-Timing: trace;desc="00-<traceId>-<spanId>-<flags>"` header to the response. JSON
  API calls get it exactly like HTML pages, which is how the toolbar finds a request's trace
  from Swagger UI. Excluded paths get no header at all: `/peekaboot/**`, your management base
  path (`/actuator/**` by default), `/static/**`, `/webjars/**` and `/error/**`. Every other
  caller gets it, and with that id anyone who can reach `/peekaboot/**` can open exactly that
  request's trace at `GET /peekaboot/api/traces/{traceId}/insights`.
- **Meters.** Every Micrometer meter's name, tags and measurements, read straight from the
  `MeterRegistry`. Tag values are masked the same way as everything else, and no request
  parameter unmasks them.
- **Metric history**, through `/peekaboot/api/insights/**`. The charts' backing rings hold
  up to 30 days of CPU, memory, thread, HTTP, connection-pool and log-event samples at the
  defaults, and `/config` additionally names every meter being collected. Nothing here is
  masked, because none of it carries values a masking rule would recognise. It does describe
  your application's shape and load over time to anyone who can reach the endpoint. See
  [Insights]({{ '/docs/insights/' | relative_url }}).

The dashboard's actuator-backed tabs are served by
`GET /peekaboot/api/actuator/all/insights`, one call that reads every source listed under
[HTTP API, what `insights` adds]({{ '/docs/api/' | relative_url }}#what-insights-adds).
That is the whole actuator surface Peekaboot exposes over HTTP. It is also a cost. `env` and
`configprops` are not free on a large application, and without a `SecurityFilterChain` in
front of `/peekaboot/**` anyone who can reach it can ask for all of them as often as they
like.

## What Peekaboot writes to disk {#what-peekaboot-writes-to-disk}

On a local run Peekaboot keeps two files, by default under
`${user.home}/.peekaboot/<groupId>.<artifactId>/`, so that the charts and the run history
survive a restart. This follows the launch context, not `peekaboot.enabled`, so an
application that switches Peekaboot on deliberately in a shared environment writes nothing to
that host. See [Configuration,
`peekaboot.storage`]({{ '/docs/configuration/' | relative_url }}#peekabootstorage).

What lands in them is worth knowing precisely:

- `insights.snapshot` holds the charts' aggregated numbers, keyed by the series ids your
  panel file defines (which default to the meter name). That is the same shape-and-load
  picture the insights endpoints already serve, with no request data, property values or
  captured traces.
- `lifecycle.jsonl` holds one line per start or stop: a timestamp, a pid, and only the
  `build-info` and `git-info` entries the Lifecycle views actually render (`version`, `time`,
  `branch`, `commit.id`, `commit.id.full`, `commit.id.abbrev`, `build.version` and
  `build.time`). Everything else the two plugins emit is dropped before the line is written,
  including the git remote URL, which for an HTTPS remote can carry the token it was cloned
  with, the building user's name and mail address, and anything your build wrote into
  `build-info.properties`.

A third file, `security.properties`, lands in the same directory whenever [the automatic
dashboard guard](#securing-the-dashboard) generates a password - the default outside local
development, never on a local run. It holds a PBKDF2 hash of that password, never the password
itself, follows `peekaboot.storage.enabled` the same way the other two do, and the file itself
is created owner-only (`rw-------`), same as them. `peekaboot.security.credentials-file` writes
it to an explicit path instead, regardless of the storage switch. See [Configuration,
`peekaboot.security`]({{ '/docs/configuration/' | relative_url }}#peekabootsecurity).

Request traces, captured headers, environment properties and config values are never written
to disk. They live in memory for the life of the process and no further. Set
`peekaboot.storage.enabled: false` to write nothing at all, or `peekaboot.storage.dir` to put
whichever of these files land there somewhere you control.

## What Peekaboot does not do {#what-peekaboot-does-not-do}

Peekaboot never exposes raw Actuator endpoints over HTTP. It builds its own `info`, `env`,
`configprops`, `loggers`, `flyway` and `scheduledtasks` endpoint objects and reads them
in-process, so no `management.endpoints.web.exposure` configuration is needed, none is
added, and nothing on `/actuator/**` changes. Which endpoints your application serves, and
what they answer, is the same with or without Peekaboot. Health is the one endpoint
Peekaboot borrows rather than builds. So that its bean exists, Peekaboot marks the health
endpoint as available while `peekaboot.enabled` is `true`, but that never reaches the
`/actuator/**` HTTP mapping, which applies your own `include`/`exclude` settings
independently. With Spring's defaults, `/actuator/health` alone stays reachable over HTTP
while the dashboard has full data on everything else. `management.endpoint.health.access:
none` still removes that bean, and the dashboard's health data with it.

With Peekaboot off there is nothing under `/peekaboot/**` at all, the UI assets included. The
dashboard bundle ships at `classpath:/META-INF/peekaboot/ui/`, outside every location Spring
serves static resources from, and the resource handler that maps it is registered only while
`peekaboot.enabled` is `true`. An excluded starter and a disabled one differ in what sits on
the class path, not in what is reachable.

## Masking {#masking}

Spring Boot's `env` and `configprops` endpoints normally mask values through a `Sanitizer`,
which runs whatever `SanitizingFunction` beans are present in the application context. As of
the Spring Boot version Peekaboot builds and ships against (4.1), **Spring Boot itself
registers no default one**. An application has to declare its own `@Bean SanitizingFunction`
for any of that machinery to run at all.

Peekaboot does not rely on it. It ships its own masking engine and applies it, on by default,
in addition to whatever your application declares, everywhere a value could carry a secret:

- `@ConfigurationProperties` values (Config tab) and environment property values
  (Environment tab).
- Health indicator details, the free-form `info.build` map on the Overview tab, and
  datasource connection parameters.
- Micrometer meter tags.
- On a captured trace: request and response headers, query and form parameters, span tags,
  span error messages, and SQL text.
- The database connection parameters in Peekaboot's own startup log line, the one masking
  site that writes to your log rather than to HTTP.

There is nothing to configure to get this. It is the default, and it runs whether or not your
application declares a `SanitizingFunction` of its own. One you do declare runs as well,
inside Peekaboot's `env` and `configprops` reads, so a value it masks reaches Peekaboot
already as `******`.

### What gets masked, and how {#what-gets-masked-and-how}

Two independent rule sets, evaluated together, using Spring's own masked-value literal
(`******`).

**By key name.** A key is sensitive if any of these appears in it as a whole separator- or
camelCase-delimited token.

```
password              passwords             passwd
passwds               pwd                   passphrase
passphrases           secret                secrets
client-secret         client-secrets        token
tokens                access-token          refresh-token
id-token              auth-token            bearer
credential            credentials           api-key
api-keys              apikey                apikeys
access-key            access-keys           private-key
private-keys          secret-key            secret-keys
signing-key           signing-keys          encryption-key
encryption-keys       authorization         auth
session-id            salt                  signature
sig                   certificate-password  certificate-private-key
```

A sensitive key masks its **entire** value. Four regular expressions inherited from Spring
Boot 2.x's own removed `Sanitizer` defaults are matched against the key as well:
`vcap_services`, `^vcap\.services.*$`, `sun.java.command` and
`^spring[._]application[._]json$`. Two of those, `vcap_services` and `sun.java.command`, are
unanchored and match anywhere in a key.

Every rule word matches only as a whole token, so `design` and `signal` stay untouched. `sig`
is there for Azure SAS's abbreviated signature parameter (`?sig=`).

Four narrower rules match only when they are the *entire* key, not merely a token inside it:
`cookie` and `set-cookie`, plus the two span attributes that carry those headers on a captured
request, `http.request.header.cookie` and `http.response.header.set-cookie`. They exist for
the HTTP headers of the same name, not for the token "cookie" appearing anywhere in a compound
key. The rule judges the whole dotted path, so a session-cookie configuration property like
`server.servlet.session.cookie.same-site` is not a secret and the
`server.servlet.session.cookie.*` subtree stays legible on the Config tab.

One exact-key spelling is excluded outright despite matching a rule word: upper-case `PWD`,
the POSIX shell's current-working-directory variable, which would otherwise collide with the
`pwd` password abbreviation on every developer's environment-variables property source. The
exemption is that one whole key and nothing wider. A compound key like `db.PWD` still masks,
and so does a `PWD=` parameter found *inside* a value, whether that is a SQL Server or ODBC
connection string's `;PWD=` or a login form's `?PWD=`. In both of those the word is a
parameter name rather than the shell variable the exemption was written for.

Bare `key` and bare `certificate` are deliberately absent. They would catch
`spring.jpa.key-generator`, `server.ssl.key-store` and `server.ssl.certificate`, which name
filesystem paths rather than secrets, and that is exactly the kind of over-masking that makes
a dashboard useless. Nothing compensates for the gap by key name. A PEM private key held
under such a key is still caught, by the value-shape pattern below.

A key whose *last* token is `uri` or `url` names an address rather than a secret, so the word
list is not applied to it. Only the four inherited patterns above still are. That is what
keeps `spring.security.oauth2.client.provider.<x>.token-uri` and `.authorization-uri`
readable. They are public endpoints, and among the first properties you check when an OAuth2
login misbehaves, though Spring Boot 2's `Sanitizer` masked them. The waiver is applied before
the word list runs, so it silences every rule word in the key and not only the final one:
`app.password-url`, `app.secret.uri` and `spring.datasource.password.url` are all shown
verbatim. Under such a key, only a value shape or one of the four inherited patterns will
catch a credential. Only the *last* token is waived, so `app.token-uri.password` still masks,
and a `vcap.services` binding's `…credentials.uri` is still caught by `^vcap\.services.*$`. A
credential carried *inside* such a URL is caught by value shape: an `?access_token=…` on a
`token-uri` has that parameter blacked out and the rest of the URL left readable.

**By value shape**, for a credential sitting inside a value under an otherwise innocuous key.
A JDBC URL's `password=` parameter is the canonical case. A small set of high-precision,
provider-prefixed patterns catches a JWT, an AWS, GitHub, GCP, Slack, Stripe, OpenAI or
Anthropic key, and credentials embedded in a URL's userinfo (`user:pass@host`, including
Oracle's `jdbc:oracle:thin:user/password@host` form). One further pattern matches a PEM
private key block, from its `-----BEGIN … PRIVATE KEY-----` header through its
`-----END … PRIVATE KEY-----` footer, newlines included. A block whose footer is missing
masks to the end of the value, and two adjacent blocks mask separately. Two more shapes
carry no word list of their own: a URL's query or `;`-separated parameters
(`?password=...`, `;pwd=...`) and the `-Dname=value` / `--name=value` options in a value
such as `JAVA_TOOL_OPTIONS` or `JDK_JAVA_OPTIONS`. Each parameter or option is judged by its name against the key-name list
above, so a name that masks as a property masks here too, its value blacked out and the name
left readable. Both of those shapes need their marker: a bare `password=hunter2` with no
leading `?`, `&`, `;`, `-D` or `--` is not a parameter and is not masked. Only the matched
span is masked, never the whole value, so a JDBC URL keeps its host and database name visible
with just the credential blacked out.

The key-name list and value shapes above are the complete set, not a sample. If a key or shape
is not described here, it is not covered.

<div class="pk-callout pk-callout--warning" markdown="1">
**This is not exhaustive, and there is no entropy detection.** Key-name rules plus a bounded
set of value-shape patterns catch the common, recognisable cases. They cannot catch a
credential with no recognisable shape sitting under a key that is not listed above. A
literal in an ordinary-looking column
(`INSERT INTO users (password) VALUES ('hunter2')`) is not masked, because "hunter2"
matches no provider pattern and SQL-text masking is value-shape-only, never column-aware.
There is no entropy detection because flagging any high-randomness string would destroy
legitimate values on screen, a git SHA, a UUID or a base64-encoded asset among them. Assume
every captured trace can still contain plaintext SQL and plaintext request data that this does
not catch.
</div>

### Two independent opt-ins before a real value is ever shown {#masking-opt-ins}

By default, masking cannot be turned off from the browser. Two things must both be true:

1. **`peekaboot.enable-unmasking`** (default `false`). While it is `false`, there is no way,
   through the dashboard, the API or anything else, to get an unmasked value out of Peekaboot.
2. **An `unmask=true` query parameter** on `GET /peekaboot/api/actuator/all/insights`, the
   only endpoint that accepts one. Without it the endpoint masks, regardless of the property.
   With it, and *only* while the property above is also `true`, it returns real values. The
   parameter alone does nothing and cannot be used as a bypass by itself.

The dashboard's Environment and Config tabs carry a "Show secrets" toggle that drives the
parameter, but only when `GET /peekaboot/api/features` reports `unmaskingEnabled: true`. When
the property is off the control is absent from the page entirely rather than merely disabled,
so the UI never offers a switch that cannot work. See [The
dashboard]({{ '/docs/dashboard/' | relative_url }}#environment-vs-config) for what toggling it
does. Its state is not persisted: reloading the page, or opening a new tab, starts masked
again.

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-config-light.png' | relative_url }}"
       alt="The Config tab with the spring.datasource group expanded, its password value rendered as ****** alongside real values for its other properties, with a Show secrets toggle above the group list."
       loading="lazy">
  <figcaption class="has-text-grey is-size-7">Masked. What every reader gets by default,
  <code>enable-unmasking</code> on or off.
  </figcaption>
</figure>

<figure class="image">
  <img src="{{ '/assets/img/screenshots/dashboard-config-revealed-light.png' | relative_url }}"
       alt="The same spring.datasource group after clicking Show secrets. Its password value now reads sample_app_db_pwd instead of ******, and everything else on the tab is unchanged."
       loading="lazy">
  <figcaption class="has-text-grey is-size-7">Revealed, only after
  <code>enable-unmasking</code> is on <em>and</em> Show secrets is clicked.
  </figcaption>
</figure>

The same tab and the same run, before and after the toggle is clicked. The revealed value is
the sample application's placeholder password, already public in its `compose.yml`. What
matters is the two steps it took to get there: a server-side property Peekaboot ships off by
default, *and* a click nobody makes by accident.

### Actuator's `show-values` does not apply {#show-values-does-not-apply}

Peekaboot reads `env` and `configprops` through endpoint objects it builds itself, with
values always shown, so `management.endpoint.env.show-values` and
`.configprops.show-values` have no effect on the dashboard in either direction. Setting
them to `never` does not blank the Environment and Config tabs; what those tabs mask is
Peekaboot's own engine's decision alone. Peekaboot never sets either property for you, so
your own `/actuator/env` and `/actuator/configprops` stay exactly as you configured them,
on a local run as anywhere else. Turning `peekaboot.enabled` on in a shared environment
therefore gets a dashboard whose Environment and Config tabs show real values, masked by
the rules above, and widens nothing on `/actuator/**`.

### What is left unmasked entirely {#what-is-left-unmasked-entirely}

- **Log message content**, wherever it is captured. Peekaboot's log capture copies whatever
  your logging statements produced, unmodified. There is no masking pass over log messages, by
  key or by shape.
- Anything a value-shape rule does not recognise and no key name catches. See the callout
  above.

## Securing the dashboard {#securing-the-dashboard}

Put your application's own Spring Security chain in front of `/peekaboot/**`, restricted to a
specific role. That is the recommendation regardless of what Peekaboot does on its own if you
don't (see [below](#if-nothing-else-secures-it)). The worked example below does this with Spring
Security's lambda DSL, alongside the two pieces it needs to actually work: your application's
own chain, and wherever `ROLE_ADMIN` comes from.

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class PeekabootSecurityConfig {

    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    public SecurityFilterChain peekabootSecurityFilterChain(HttpSecurity http) throws Exception {
        return http.securityMatcher("/peekaboot/**")
                .authorizeHttpRequests(auth -> auth.anyRequest().hasRole("ADMIN"))
                .httpBasic(Customizer.withDefaults())
                .build();
    }

    /**
     * Your application's own chain, whatever it already is. What matters is that it carries
     * no {@code @Order} at all, so it keeps Spring Security's default of
     * {@link Ordered#LOWEST_PRECEDENCE} and is evaluated last, as the catch-all. This sample
     * application has no access rules of its own, hence {@code permitAll}.
     */
    @Bean
    public SecurityFilterChain applicationSecurityFilterChain(HttpSecurity http) throws Exception {
        return http.authorizeHttpRequests(auth -> auth.anyRequest().permitAll()).build();
    }

    /**
     * Where {@code ROLE_ADMIN} comes from. An in-memory store with literal passwords is an
     * illustration, not a recommendation - replace it with whatever your application already
     * authenticates against.
     */
    @Bean
    public UserDetailsService userDetailsService() {
        return new InMemoryUserDetailsManager(
                User.withUsername("admin")
                        .password("{noop}admin-password")
                        .roles("ADMIN")
                        .build(),
                User.withUsername("user")
                        .password("{noop}user-password")
                        .roles("USER")
                        .build());
    }
}
```

`securityMatcher("/peekaboot/**")` scopes the first chain to Peekaboot's own paths. When
multiple `SecurityFilterChain` beans exist, Spring Security evaluates them in ascending
`@Order` order and uses the first whose `securityMatcher` matches. **Lower values are
evaluated first**, the opposite of "falls through as a catch-all".
`@Order(Ordered.HIGHEST_PRECEDENCE)` guarantees the Peekaboot chain is checked before any
other, so `/peekaboot/**` cannot accidentally reach your application's general chain first.
That general chain, `applicationSecurityFilterChain` above and whatever yours actually does,
carries no `@Order` at all, so it keeps Spring Security's default of
`Ordered.LOWEST_PRECEDENCE` and is evaluated last. Do not fold a `/peekaboot/**` rule into it
instead of using the first chain, and do not give it an `@Order` lower than the first chain's.
Either would let it match `/peekaboot/**` first and silently bypass the restriction this page
just told you to add.

<div class="pk-callout pk-callout--warning" markdown="1">
**Do not paste `applicationSecurityFilterChain` over rules you already have.** It permits
everything, because this sample application has nothing of its own to protect. If your
application already has a chain, keep that one and add only the first bean. The second is in
the example for two reasons. One is the ordering relationship described above. The other is
that defining any `SecurityFilterChain` of your own switches off the default chain Spring Boot
would otherwise contribute
([`DefaultWebSecurityCondition`](https://github.com/spring-projects/spring-boot/blob/main/module/spring-boot-security/src/main/java/org/springframework/boot/security/autoconfigure/web/servlet/DefaultWebSecurityCondition.java)
is `@ConditionalOnMissingBean(SecurityFilterChain.class)`). With the Peekaboot chain alone,
every request that is not `/peekaboot/**` matches no chain at all and passes through
unsecured.
</div>

Swap `httpBasic` for whatever your application already uses (form login, OAuth2, a
gateway-issued header). The part that matters is `.hasRole(...)`, or `.authenticated()` if any
logged-in user should be trusted with this data, actually gating `/peekaboot/**`. The
in-memory `UserDetailsService` is there to make the example runnable and to show where the role
is expected to come from; replace it with whatever your application already authenticates
against.

The class above is not a sketch. It is
[`PeekabootSecurityConfig`]({{ site.repository_url }}/blob/HEAD/peekaboot-testing-app/src/test/java/org/peekaboot/example/security/PeekabootSecurityConfig.java)
in the product repository, loaded unmodified into the sample application by
[`SecuredPeekabootIT`]({{ site.repository_url }}/blob/HEAD/peekaboot-testing-app/src/test/java/org/peekaboot/testingapp/integration/SecuredPeekabootIT.java),
which pins the HTTP contract, and
[`SecuredDashboardIT`]({{ site.repository_url }}/blob/HEAD/peekaboot-testing-app/src/test/java/org/peekaboot/testingapp/ui/SecuredDashboardIT.java),
which pins the toolbar's authorization behaviour and its notice text in real Chromium.

### The dev toolbar asks the reader to sign in {#toolbar-requires-sign-in}

The [dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}) is rendered into your
application's own HTML by a servlet filter, server-side, before anything knows who is asking.
The bar lands on the page whether or not the reader may read Peekaboot's data, carrying the
stylesheets it needs with it. What it cannot do without authorization is load
`/peekaboot/ui/toolbar/toolbar.js`, the module that fills the bar with the request's trace.
That is a `/peekaboot/**` request like any other, and the chain above refuses it.

So outside the role the bar appears, but empty, showing a link to the dashboard that reads:

```
Peekaboot toolbar could not start — sign in, or check that its script is allowed to load
```

Following it lands the reader on `/peekaboot/`, which *is* gated. Their browser gets the `401`
and its `WWW-Authenticate` challenge, prompts for credentials, and once they have
authenticated the toolbar fills in normally on the next page they load. Whoever you gate
`/peekaboot/**` on is still exactly the set of people who get trace data. What changed is that
everyone else is told why they do not, instead of seeing a page with no toolbar and no
explanation.

One caveat if your application sends a strict `Content-Security-Policy`. The bar's styles
travel inline, and a policy without `style-src 'unsafe-inline'` drops them. A reader inside the
role is unaffected, because the same sheets are also linked and those load normally. A reader
outside the role has neither, since the links are `/peekaboot/**` requests the chain refuses,
so the bar arrives as plain text at the foot of the page rather than as a strip along the
bottom.

The script side of the same policy affects every reader, signed in or not. A `script-src` that
does not allow `/peekaboot/ui/toolbar/toolbar.js` to load blocks the module that fills the bar
in, so the bar stays on the same pre-boot notice even for a reader the chain would have
admitted. A policy permitting `'self'` scripts covers it. A nonce-only policy does not, and
cannot be satisfied: Peekaboot puts no `nonce` attribute on the script tag, so the only fix is
to allow the path.

### If nothing else secures it {#if-nothing-else-secures-it}

On a deployment launch - not local development, not a test - with `peekaboot.enabled=true` and
nothing already authenticating `/peekaboot/**`, Peekaboot arms this for you rather than leaving
the dashboard open. It generates a username, `<artifact>-admin` unless
`peekaboot.security.username` says otherwise, and a 26-character password, printed once in the
startup log's `Peekaboot Security` block and stored only as a PBKDF2-HMAC-SHA256 hash - never
the password itself. `peekaboot.security.password` supplies one directly instead; nothing is
generated or written in that case. See [What Peekaboot writes to
disk](#what-peekaboot-writes-to-disk) for where the hash lands and when.

It stands down the moment a request already arrived authenticated. Your own
`SecurityFilterChain` above, or any other Spring Security authentication that covers
`/peekaboot/**`, keeps working exactly as configured, and Peekaboot never sees a request it
needs to challenge. What it cannot see is protection outside Spring Security altogether - a
VPN, an nginx basic-auth layer, an IP allowlist, an API gateway. None of those puts an
authenticated principal on the request, so the guard still arms in front of them.

`peekaboot.security.enabled=false` turns it off entirely, for a consumer who wants no guard at
all rather than a replacement one. A deployment launch still logs one WARN naming the dashboard
as unauthenticated, so turning it off is a decision you see at startup, not a silent gap.

**There is no throttle on failed attempts.** Each wrong password still costs one PBKDF2
derivation, roughly 100 ms, and nothing bounds how many an attacker can send. Rate limiting for
a deployed dashboard belongs at the proxy in front of it, not here. This is a stop-gap for a
dashboard nobody secured - the `SecurityFilterChain` above stays the recommendation.

## Running it in a deployed environment {#running-it-in-a-deployed-environment}

If you have a genuine reason to run Peekaboot somewhere other than your own machine (a shared
staging environment, say), read [Do I want this in
production?]({{ '/docs/in-production/' | relative_url }}) first, set `peekaboot.enabled=true`
explicitly, and put the `SecurityFilterChain` above in front of it before anything else. The
[automatic fallback](#if-nothing-else-secures-it) arms itself if you skip this, but it is a
stop-gap, not a reason to. Restricting network reachability as well (an internal-only ingress
rule, a VPN, a sidecar that only proxies `/peekaboot/**` from trusted sources) is worth doing in
addition to authentication, not instead of it. Whoever your authentication boundary now admits
has read access to everything in [What the dashboard and API
expose](#what-the-dashboard-and-api-expose). Choose the role or group you gate on with that in
mind, not just "logged in".

## Keeping it out of production entirely {#keeping-it-out-of-production-entirely}

If Peekaboot should never ship in a production artifact regardless of what `peekaboot.enabled`
resolves to, exclude the starter at packaging time. See [Do I want this in production?,
keeping it out of the artifact
entirely]({{ '/docs/in-production/' | relative_url }}#keeping-it-out-of-the-artifact-entirely)
for the full Maven `excludes` and Gradle `developmentOnly` examples.

## Production checklist {#production-checklist}

[Do I want this in production?]({{ '/docs/in-production/' | relative_url }}) is the question
behind this list: what Peekaboot costs while it is on, and what it cannot do for you past one
process.

- [ ] Do not rely on the default. Verify `peekaboot.enabled` actually resolves to `false` in
      your deployed environment. Check the startup summary, or the value reported on the
      dashboard's own Environment tab in a non-production environment where you can still
      reach it.
- [ ] Set `peekaboot.enabled=false` explicitly (or exclude the starter) if you run your build
      output directly on a host that is not a container (`java -cp target/classes:…`). That is
      the one deployment the detection still reads as local. See [Configuration, what counts
      as a local run]({{ '/docs/configuration/' | relative_url }}#local-run).
- [ ] If Peekaboot should never ship at all, exclude the starter from the production artifact
      (Maven `excludes` / Gradle `developmentOnly`) rather than trusting
      `peekaboot.enabled=false` alone.
- [ ] If you do turn it on somewhere reachable, put a `SecurityFilterChain` in front of
      `/peekaboot/**` first, not after.
- [ ] Do not reach for `management.endpoints.web.exposure` as a protection here. It governs
      which endpoints `/actuator/**` serves, a mapping Peekaboot does not use or widen.
- [ ] Leave `peekaboot.enable-unmasking` at its default (`false`) unless you specifically need
      to reveal real values from the dashboard. A request parameter alone cannot bypass it,
      but turning it on lets anyone who can reach `/peekaboot/**` and add `?unmask=true`
      reveal them too.
- [ ] Do not treat masking as complete. It catches known key names and known secret shapes
      (JWT, common cloud-provider key prefixes, credentials in a URL, a PEM private key).
      It does not catch an arbitrary secret with no recognisable shape, or log message
      content at all. Assume every captured trace can still contain plaintext SQL
      and, with the dev toolbar on, plaintext headers and query and form parameters. Do not
      point Peekaboot at traffic carrying secrets you cannot afford to have held in memory and
      displayed.
- [ ] Leave `peekaboot.dev-toolbar` at its default (auto-detected, off outside a local run)
      unless you specifically need request and response capture. It is the setting that turns
      trace data from a method/path/status summary into full header and parameter capture. It
      follows the same detection as `peekaboot.enabled`, so a deployment the detection reads
      as local (see the second item) gets the toolbar too. `peekaboot.enabled=false` switches
      it off along with everything else.
