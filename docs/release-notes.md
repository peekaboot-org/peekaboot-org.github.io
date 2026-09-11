---
title: Release notes
lead: What changed in each release, and what an upgrade needs from you.
permalink: /docs/release-notes/
---

## 0.2.0 {#v0-2-0}

Peekaboot now protects the dashboard on its own. On a deployment launch - not local
development, not a test - with `peekaboot.enabled=true` and nothing already authenticating
`/peekaboot/**`, Peekaboot generates a username and password, challenges unauthenticated
requests with HTTP Basic, and stores only a PBKDF2 hash of the password. It stands down the
moment a request already arrived authenticated, so an application's own `SecurityFilterChain`
keeps working exactly as before. This is a stop-gap for a dashboard nobody secured, not a
replacement for [putting your own `SecurityFilterChain` in front of
it]({{ '/docs/security/' | relative_url }}#securing-the-dashboard); there is no throttle on
failed attempts. See [Security: if nothing else secures
it]({{ '/docs/security/' | relative_url }}#if-nothing-else-secures-it).

New properties, all under [`peekaboot.security`]({{ '/docs/configuration/' | relative_url }}#peekabootsecurity):

- `enabled` (detected: off on a local run, on a deployment launch) turns the guard off
  entirely.
- `username` overrides the generated `<artifact>-admin`.
- `password` supplies a fixed password instead of generating one; never written to disk.
- `credentials-file` sets an explicit path for the stored hash, written and read regardless of
  `peekaboot.storage.enabled`.

### Upgrading {#upgrading}

Three ways this can surprise an application that did nothing differently.

- **The dashboard started returning 401 after upgrading**, on a deployment where nothing
  Peekaboot can see authenticates `/peekaboot/**` - a VPN, an nginx basic-auth layer, an IP
  allowlist and similar perimeter controls are invisible to it. See
  [Troubleshooting]({{ '/docs/troubleshooting/' | relative_url }}#dashboard-401-after-upgrading).
- **A smoke test that boots the packaged jar started failing with 401.** Booting the packaged
  artifact in its own process, the way Testcontainers or docker-compose does, is a deployment
  launch as far as Peekaboot can tell. See
  [Troubleshooting]({{ '/docs/troubleshooting/' | relative_url }}#smoke-test-401).
- **Users see a browser credential dialog on ordinary application pages** wherever the dev
  toolbar is explicitly on in a deployed environment: its own requests now get challenged too.
  See
  [Troubleshooting]({{ '/docs/troubleshooting/' | relative_url }}#credential-dialog-on-toolbar-pages).

The starter now brings its own JDBC instrumentation (`datasource-micrometer`). A
`DataSource` nobody instruments emits no query spans, and nothing downstream can tell that
apart from an endpoint that genuinely runs no queries - both used to read as `0`. Queries
now show up in the [Queries tab]({{ '/docs/dev-toolbar/' | relative_url }}#the-trace-view),
the trace tree and Insights without wiring anything up. A host that instruments its own
`DataSource` excludes the starter's copy, or sets `jdbc.datasource-proxy.enabled=false`.

Query spans carry their row count now, in the same trace view. It used to sit only on
datasource-proxy's separate result-set span, which is not the span anyone reads, so it went
unseen; it is paired onto the query span itself and formatted for the reader's locale.

`/peekaboot/api/features` gained `tracingSpansPossible`. `tracing` only says the trace store
exists; `false` on the new field is a hard guarantee that nothing will ever fill it, because
there is no OpenTelemetry SDK on the classpath to emit a span at all. See
[HTTP API]({{ '/docs/api/' | relative_url }}).

### Fixes {#fixes}

- A `forward:` view runs a second dispatch inside the first one's rendering; the inner
  dispatch overwrote the outer one's observation instead of nesting under it. The outer
  observation was left open, and its trace context stuck to the pooled thread for
  whatever request that thread served next - now the inner dispatch nests properly.
- Tomcat 11 suspends a wrapped response after a forward and silently dropped the toolbar's
  write; forwarded pages carry the toolbar again.
- Local-dev detection missed two real setups and left Peekaboot off: IntelliJ's "shorten
  command line: JAR manifest" launcher, and Spring Boot DevTools restarting from a Jib image
  or an extracted layout. Both are detected correctly now.
- Masking closed several gaps: PEM private key bodies (previously only the header), plural
  secret key names (`passphrases`, `signing-keys`, `encryption-keys`, `secrets`,
  `passwords`), a scheduled task's own exception text, and credentials in upper-case URL
  schemes. A JDBC URL's password can no longer reach application logs through a datasource
  metadata record's default `toString()`.
- Application shutdown no longer hangs behind a dashboard client that disconnected
  mid-write.
- The Insights tab now says "Live updates stopped" instead of freezing silently when its
  stream closes for good, and reopens less often - its server-side timeout went from 5 to
  30 minutes.
- A trace tree containing a genuine span cycle no longer sends the mapper into infinite
  recursion; a client-side span under an excluded path is no longer dropped without a
  marker.

## 0.1.0 {#v0-1-0}

First release, published to Maven Central on 2026-09-04.
