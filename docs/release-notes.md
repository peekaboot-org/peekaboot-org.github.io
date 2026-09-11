---
title: Release notes
lead: What changed in each release, and what an upgrade needs from you.
permalink: /docs/release-notes/
---

## 0.2.0

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

### Upgrading

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
