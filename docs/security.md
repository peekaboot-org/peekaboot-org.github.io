---
title: Security
lead: What Peekaboot exposes while it is on, and how to put a lock in front of it.
permalink: /docs/security/
---

<div class="pk-callout pk-callout--danger" markdown="1">
On a [local run]({{ '/docs/configuration/' | relative_url }}#local-run) Peekaboot's guard is
off, and Peekaboot answers only the machine it runs on. Anyone on that machine reads everything
under `/peekaboot/**` without signing in: configuration, environment values, health, logs,
migrations and full request traces. With `peekaboot.remote-access.enabled=true`, so does anyone
who can reach your application's port. If other people use that machine or can reach that
port, secure `/peekaboot/**` first or turn Peekaboot off.
</div>

## Who can reach Peekaboot, and when it is on {#who-can-reach-peekaboot}

Peekaboot is on for a local run and off for a deployment or a test, unless you set it.
[Configuration, when Peekaboot is on]({{ '/docs/configuration/' | relative_url }}#when-peekaboot-is-on)
has the table and the detection rules.

What that means for access:

- **Local run.** Peekaboot answers only the machine it runs on, without authentication. Every
  other request gets a `403` with a [problem body]({{ '/docs/api/' | relative_url }}#errors)
  that names `peekaboot.remote-access.enabled`.
- **Local run with `server.forward-headers-strategy=native`.** Another machine can pass that rule
  with forged forwarding headers. Leave that strategy out, bind the application with `server.address=127.0.0.1`, or arm [Peekaboot's
  guard](#peekaboots-guard).
- **Local run with `peekaboot.remote-access.enabled=true`.** Anyone who can reach the port reads
  `/peekaboot/**` without signing in, and Peekaboot logs a WARN at startup. To let other machines
  in behind a login, set `peekaboot.security.enabled=true` instead.
- **Local run, toolbar and error page.** A browser request that fails gets the exception, its
  message and its full stack trace, on the failing URL. A request that does not pass the rule
  above gets the status and the path only, and no toolbar on any page.
- **Deployment with `peekaboot.enabled=true`.** Peekaboot's HTTP Basic guard challenges every
  `/peekaboot/**` request. Switch it off to use your own security. See [Peekaboot's
  guard](#peekaboots-guard).

## What the dashboard and API show {#what-the-dashboard-and-api-expose}

This is the complete list. Anyone who can reach `/peekaboot/**` can read all of it.

| Data | Where | Masked |
|---|---|---|
| Every resolved property source, key and value | Environment tab | By key and by value shape |
| Every `@ConfigurationProperties` value | Config tab | By key and by value shape |
| Health status and per-component detail, custom indicators included | Overview | By key and by value shape |
| Build metadata (`info.build`) | Overview | By key and by value shape |
| Git branch, commit id and commit time of the application's own `git.properties` | Overview | No. Peekaboot passes on only these three entries, so a remote URL or committer address never shows. |
| Datasource host, port, database name, user, product and driver version | Overview | Connection parameters only. The user is shown as is. Host and database name are hidden where the JDBC URL could carry a credential in them, under the same rules as the [health report]({{ '/docs/api/' | relative_url }}#health). |
| Process identity: OS user, uid, gid, pid, parent-process chain with command names | Overview | No |
| Machine: CPU count and model, physical memory, max heap, container runtime, every non-local IP address and its hostname | Overview, `runtime.machine` and `runtime.memory` in the API | No |
| Logger levels, configured and effective | Loggers tab | Nothing to mask. The API is GET-only, so levels cannot be changed. |
| Flyway migrations: version, description, script, type, duration, install time, status | Flyway tab | No |
| Liquibase change sets: execution order, id, author, change log, description, execution date, status | Liquibase tab | No |
| Scheduled tasks: schedule, last and next run, last failure's exception type and message | Scheduled Tasks tab | Failure text and a custom trigger's description by value shape |
| Start and stop history with version, branch, commit and build time per run, unclean shutdowns | Lifecycle tab, `/peekaboot/api/lifecycle/**` | No |
| Micrometer meters: names, tags, measurements | Meters tab | Tag values by key and by value shape |
| Up to 30 days of CPU, memory, thread, HTTP, connection-pool and log-event history, and the list of collected meters | Insights tab, `/peekaboot/api/insights/**` | No |
| Request traces: span tree, span names, timings, tags, the exception and stack trace of a failed span, SQL text and bind parameters | Traces tab, toolbar | Tags, exceptions, SQL and bind parameters by value shape only |
| Request and response headers, query and form parameters, resolved controller | Traces tab, toolbar | Headers and parameters by key and by value shape. A value over 4,096 characters is cut. |
| The message and stack trace of every log event, inside a trace or not, and the names of its logger and thread | Logs tab of a trace, `/peekaboot/api/logs` | Message and stack trace by value shape only. Logger and thread names are shown as is. |

SQL text is shown as your JDBC instrumentation records it, with any literal values, and bind
parameters are shown too. Masking applies to what Peekaboot shows. An application that also
exports its traces, over OTLP for example, sends the SQL and the bind parameters unmasked.
Request and response bodies are never captured.

With tracing on, every response carries
`Server-Timing: trace;desc="00-<traceId>-<spanId>-<flags>"`, JSON API calls included.
Anyone who reads that header and can reach `/peekaboot/**` can open that request's trace at
`GET /peekaboot/api/traces/{traceId}`.

No page can frame the dashboard.

## What the error page shows {#the-error-page}

The error page shows every detail Spring Boot's `ErrorAttributes` has: the status, the request
line, the exception class, its message and the full stack trace. The message and the stack
trace are masked by value shape; the request line is shown as sent. Your
`spring.web.error.include-*` settings do not limit it. Requests that ask for JSON get Spring
Boot's normal error response instead.

It is on for a local run and off for a deployment or a test. Which requests get the detail on a
local run is under [who can reach Peekaboot](#who-can-reach-peekaboot).

Turned on for a deployment, the page is outside Peekaboot's guard and Peekaboot logs a WARN
about it. When it backs off for your own error page, and how `override` outranks that page, is
on [Error page]({{ '/docs/error-page/' | relative_url }}).

## What stays in memory and what goes to disk {#what-peekaboot-writes-to-disk}

Environment values and config values stay in memory. Peekaboot writes files only while
`peekaboot.storage.enabled` is `true`, which is the default for a local run only. Traces and
their log lines go to disk while storage and trace storage are on, as the table shows.

{% include facts/storage-files.md %}

A password in a bind parameter or a log line is on disk in clear until its trace or line leaves
the store. Keep `peekaboot.storage.dir` readable by you only, or set
`peekaboot.storage.traces.enabled: false`. Where the files live, when they are written and their
permissions are under [Configuration, `peekaboot.storage`]({{ '/docs/configuration/' | relative_url }}#peekabootstorage).

## Peekaboot leaves `/actuator` alone {#what-peekaboot-does-not-do}

Peekaboot does not change `/actuator`. It adds nothing to `management.endpoints.web.exposure` and
sets no `management.endpoint.*` or `management.info.*` property. Actuator's exposure settings and
`show-values` do not affect `/peekaboot/**`, so setting `show-values` to `never` does not blank
the Environment and Config tabs. Protect Peekaboot with [its guard](#peekaboots-guard) or your own
security.

## Masking {#masking}

Masking is on by default and has nothing to configure. It replaces a value with `******`
wherever the Masked column of the [table above](#what-the-dashboard-and-api-expose) says so. It
also masks the request path, the database connection parameters in Peekaboot's startup log line
and the exception message and stack trace on the error page.

Your own `SanitizingFunction` beans also run on environment and config values. They do not run on
headers, parameters, span tags, SQL, log lines or the error page, and Peekaboot has no property or
bean that adds a masking rule.

`/peekaboot/api/features` names the literal in `maskLiteral`.
[Agents]({{ '/docs/agents/' | relative_url }}#masked-values) says how an agent reads it.

### What gets masked, and how {#what-gets-masked-and-how}

Two rule sets run together.

**By key name.** A key is sensitive when one of these words is a whole token of it, split at separators and
camelCase boundaries, in any case. A compatibility form of a letter, such as the long s in
`paſſword`, counts as that letter. Accents, control characters and invisible joining characters
in the key are ignored.
A sensitive key masks its entire value.

```
password              passwords             passwd
passwds               pwd                   passphrase
passphrases           pass                  pw
passcode              passcodes             secret
secrets               client-secret         client-secrets
token                 tokens                access-token
refresh-token         id-token              auth-token
bearer                credential            credentials
api-key               api-keys              apikey
apikeys               access-key            access-keys
private-key           private-keys          secret-key
secret-keys           signing-key           signing-keys
encryption-key        encryption-keys       account-key
account-keys          master-key            master-keys
dsn                   authorization         auth
session-id            salt                  signature
sig                   certificate-password  certificate-private-key
```

- These key patterns also mask: `vcap_services` and `sun.java.command` anywhere in the key,
  `^vcap\.services.*$`, and `^spring[._]application[._]json$`.
- `cookie`, `set-cookie`, `encrypt.key` and `jwt` mask only as the entire key.
- A database connection parameter also masks when its name holds `pass`, `pwd`, `secret`,
  `token`, `key` or `credential` anywhere, so `sslpassword` and `privatekey` mask. So do
  harmless names such as `keyStoreLocation`. The same holds for a URL or connection-string
  parameter inside an environment or config value, so the `sslpassword` in
  `spring.datasource.url` masks on the Environment and Config tabs.

**By value shape.** These patterns mask a credential inside any value, whatever its key. Only
the matched part is masked, so a JDBC URL keeps its host and database name.

| Shape | Example |
|---|---|
| JWT | `eyJhbGciOi….eyJzdWIiOi….…` |
| PEM private key, header to footer | `-----BEGIN PRIVATE KEY-----` … `-----END PRIVATE KEY-----` |
| AWS access key | `AKIA…`, `ASIA…` |
| GitHub token | `ghp_…`, `gho_…`, `ghu_…`, `ghs_…`, `ghr_…`, `github_pat_…` |
| GCP API key | `AIza…` |
| Slack token | `xoxb-…`, `xoxp-…` |
| Stripe live key | `sk_live_…`, `rk_live_…` |
| OpenAI key | `sk-proj-…`, legacy `sk-…` |
| Anthropic key | `sk-ant-…` |
| Credentials in a URL | `postgres://user:secret@host`, `redis://:secret@host` |
| Oracle thin URL | `jdbc:oracle:thin:user/secret@host` |
| URL or connection-string parameter with a sensitive name | `?password=…`, `&token=…`, `;pwd=…` |
| Command-line option with a sensitive name | `-Dspring.datasource.password=…`, `--api-key=…` in `JAVA_TOOL_OPTIONS` |
| Quoted option with a sensitive name | `password="…"` in `sasl.jaas.config` |

<div class="pk-callout pk-callout--warning" markdown="1">
Masking is not exhaustive and has no entropy detection. A credential with no recognisable shape
under a key that is not listed is shown as is. Log content is masked by value shape only.
Anything not listed here is not masked, and neither are the rows marked No in the table above.
`INSERT INTO users (password) VALUES ('hunter2')` is not masked, because SQL masking does not
know column names. Assume any captured trace can contain plaintext SQL and plaintext request
data.
</div>

### Two opt-ins before a real value is shown {#masking-opt-ins}

Masked values are revealed only when both are true:

1. `peekaboot.unmasking.enabled=true`. The default is `false`.
2. The request is `GET /peekaboot/api/actuator/all/insights?unmask=true`. No other endpoint
   accepts `unmask`.

The parameter alone does nothing. With unmasking enabled, the Environment and Config tabs show
a "Show secrets" toggle. See [The dashboard]({{ '/docs/dashboard/' | relative_url }}#environment-vs-config).

{% capture caption %}Masked, the default.{% endcapture %}
{% include screenshot.html name="dashboard-config" caption=caption %}

{% capture caption %}Revealed, with <code>unmasking.enabled</code> on and Show secrets clicked.{% endcapture %}
{% include screenshot.html name="dashboard-config-revealed" caption=caption %}

## Securing the dashboard with Spring Security {#securing-the-dashboard}

Set `peekaboot.security.enabled=false`, then put a `SecurityFilterChain` in front of
`/peekaboot/**` that requires a specific role:

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

    // Evaluated before your application's own chain, which has no @Order.
    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    public SecurityFilterChain peekabootSecurityFilterChain(HttpSecurity http) throws Exception {
        return http.securityMatcher("/peekaboot/**")
                .authorizeHttpRequests(auth -> auth.anyRequest().hasRole("ADMIN"))
                .httpBasic(Customizer.withDefaults())
                .build();
    }
}
```

Give the Peekaboot chain `securityMatcher("/peekaboot/**")` and
`@Order(Ordered.HIGHEST_PRECEDENCE)`, and leave your application's chain without `@Order`. A
`/peekaboot/**` rule in your general chain, or a lower order on that chain, matches
`/peekaboot/**` first, and the role check never runs. In an application with no chain yet,
declaring any `SecurityFilterChain` switches off Spring Boot's default chain, so add one for
every request outside `/peekaboot/**`.

Replace `httpBasic` with whatever your application uses: form login, OAuth2, a gateway header.
Use `.authenticated()` instead of `.hasRole(...)` only if every signed-in user may read
everything listed under [What the dashboard and API show](#what-the-dashboard-and-api-expose).

### The dev toolbar asks the reader to sign in {#toolbar-requires-sign-in}

The [dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}) is injected into every HTML page,
whoever is reading it. Its script and data load from `/peekaboot/**`, so your chain decides who
sees a filled toolbar. A reader your chain refuses sees an empty bar with this link:

```
Peekaboot toolbar could not start — sign in, or check that its script is allowed to load
```

The link opens `/peekaboot/` and the browser asks for credentials. The toolbar fills on the next
page load.

If your application sends a `Content-Security-Policy`:

- `script-src` must allow `/peekaboot/ui/toolbar/toolbar.js`. `'self'` covers it. A nonce-only
  policy cannot work, because Peekaboot's script tag carries no nonce. Without this the bar
  stays on the notice above for every reader.

### Peekaboot's guard {#peekaboots-guard}

<span id="if-nothing-else-secures-it"></span>On a deployment launch with
`peekaboot.enabled=true`, Peekaboot arms an HTTP Basic guard (realm `Peekaboot`) on
`/peekaboot/**`. It challenges every request, whatever else authenticated it.

{% include facts/guard-refusal.md %}

The credentials:

{% include facts/guard-credentials.md %}

<div class="pk-callout pk-callout--warning" markdown="1">
On a deployment, storage is off by default, so the generated password is not saved and
changes on every restart. The startup log says so. Keep it stable with one of these:

- `peekaboot.security.password`, set from a secret
- `peekaboot.storage.enabled=true` on a persistent home directory
- `peekaboot.security.credentials-file` pointing at a persistent path, for example a mounted
  volume in a container
</div>

An agent or a script sends the same credentials with HTTP Basic, such as
`curl -u <username>:<password>`. Set the password explicitly so it need not read the startup log.
See [Agents]({{ '/docs/agents/' | relative_url }}#authentication).

Rules to know:

- The guard challenges even a user your own security already signed in. If your security also
  reads the `Authorization` header, as HTTP Basic and bearer tokens do, the two lock each other
  out, so switch one off.
- A VPN, an nginx basic-auth layer, an IP allowlist or an API gateway in front does not
  satisfy the guard. It still challenges behind them.
- The guard is one HTTP Basic credential with no throttle on failed attempts. Rate-limit at the
  proxy in front of the application.
- `security.properties` must be accessible to its owner only. Peekaboot ignores a file others
  can access and generates a new password.
- `peekaboot.security.enabled=false` turns the guard off. Your own security must then
  authenticate `/peekaboot/**`.

The guard has one flat credential and no roles. For roles, switch it off and use the
[`SecurityFilterChain`](#securing-the-dashboard) above.

## Running it on a shared or deployed server {#running-it-in-a-deployed-environment}

<span id="production-checklist"></span>
<span id="keeping-it-out-of-production-entirely"></span>[Production use]({{ '/docs/in-production/' | relative_url }}) says what Peekaboot does on a
deployment. It lists [what to set before you turn it on
there]({{ '/docs/in-production/' | relative_url }}#before-you-turn-it-on).
