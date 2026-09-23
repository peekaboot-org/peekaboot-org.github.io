---
title: Dev toolbar
lead: A bar at the bottom of every HTML page your app renders, with the request, its trace and its logs.
permalink: /docs/dev-toolbar/
---

<figure class="image">
  <img src="{{ '/assets/img/screenshots/toolbar-collapsed-light.png' | relative_url }}"
       alt="The collapsed dev toolbar docked at the bottom of the page, showing a 200 status badge, GET /orders, the controller method, duration, query count and duration, and a copyable trace id"
       loading="lazy">
</figure>

The bar shows the response status, method and path, controller method, duration, span count,
query count and total query time, log count, error and warning log counts when there are any,
and the trace id, which copies on click. The logo opens the dashboard in a new tab. Click
anywhere else on the bar, or press Enter or Space while it has focus, to open the
[trace view](#the-trace-view).

The numbers fill in during the first few seconds, so spans that end after the response are
counted too. Numbers are formatted in the language chosen on the dashboard.

## Turn it on or off {#turn-it-on-or-off}

The toolbar needs:

- `peekaboot.enabled=true` and `peekaboot.dev-toolbar=true`. Both default to true only for a
  [local run]({{ '/docs/configuration/' | relative_url }}#local-run).
- A servlet web application.
- A Micrometer `Tracer` bean, which the starter provides. See [Quick
  start]({{ '/docs/quick-start/' | relative_url }}) for what happens without one.

```yaml
peekaboot:
  dev-toolbar: false
```

| Property | Default | Effect |
|---|---|---|
| `peekaboot.dev-toolbar` | `true` for a local run, else `false` | Injects the bar and captures request detail and logs into traces. |
| `peekaboot.ui.tracing.slow-query-threshold-ms` | `50` | Queries at or above this are marked SLOW. |
| `management.opentelemetry.tracing.export.schedule-delay` | `200ms` while the toolbar is on (Spring Boot: `5s`) | How soon a finished span reaches the bar. Your own value wins. |

See [Configuration]({{ '/docs/configuration/' | relative_url }}#what-peekaboot-sets-in-your-application)
for everything Peekaboot changes in your application.

## Pages that get the bar {#where-the-bar-appears}

A response gets the bar when its content type is `text/html` and it contains `</body>`. It
does not get the bar when:

- The path starts with `/peekaboot/`, `/static/`, `/webjars/`, `/error/` or the management
  base path (`/actuator/` by default, following `management.endpoints.web.base-path`).
- The path ends in `.css`, `.js`, `.ico`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.woff`,
  `.woff2`, `.ttf` or `.eot`.
- The request sends `X-Requested-With: XMLHttpRequest`. A plain `fetch()` does not send it,
  so HTML fetched that way gets the bar.
- The handler responds asynchronously.
- The HTML body is larger than 2 MiB. It is served unchanged.

To inject the bar, Peekaboot holds each HTML response in memory, up to 2 MiB. If generating
the bar fails, the page is served unchanged. Your page's CSS does not affect the bar.

## Request and response detail {#request-and-response-detail}

The Request tab of the trace view shows the method, path, query string, status, duration,
controller method, query and form parameters, and the request and response headers.

Headers and parameters are masked on the server, by key name and by value patterns. There is
no reveal control, so a masked value stays masked. See
[Security]({{ '/docs/security/' | relative_url }}#masking) for the rules and what they miss.
Request bodies and uploaded file names are not captured.

## The trace view {#the-trace-view}

Clicking the bar opens the same trace view the dashboard's Traces tab uses, on top of your
page. [Traces]({{ '/docs/traces/' | relative_url }}#the-trace-view) describes its Spans,
Queries, Logs and Request tabs.

## Logs for the request {#logs-correlated-to-the-request}

The Logs tab lists every log line your app wrote while handling the request, with timestamp,
level, message and the active span.

<div class="pk-callout pk-callout--warning" markdown="1">
**Log lines are not masked.** A log statement that includes a secret or personal data is
stored and shown exactly as written. See [Security]({{ '/docs/security/' | relative_url }})
for what is exposed while the toolbar is on.
</div>

## Swagger UI {#it-also-works-from-swagger-ui}

On the Swagger UI page the bar starts idle with "Waiting for request…". Run an operation with
"Try it out" and the bar shows that call's status, duration and query count. Click it for the
trace view.

This works for any traced call, JSON APIs included. Calls to `/v3/api-docs`, `/swagger-ui/`,
`/peekaboot/`, `/webjars/` and the actuator are not shown. With
`management.endpoints.web.base-path=/`, actuator calls are traced and do show up.

A custom `springdoc.swagger-ui.path` is honoured.

## The bar on the error page {#the-bar-on-the-error-page}

HTML error pages get the bar, including [Peekaboot's error
page]({{ '/docs/configuration/' | relative_url }}#peekabooterrorpage). It reports the request
that failed, not the `/error` dispatch that rendered the page. A request that Spring Security
rejects before it reaches your application, such as a 401 or 403, gets no bar on its error
page.

## With Spring Security {#with-spring-security}

The bar loads its data from `/peekaboot/**`. A reader who is not allowed there sees the bar
with this notice instead of the numbers:

```
Peekaboot toolbar could not start — sign in, or check that its script is allowed to load
```

The same notice appears when a Content-Security-Policy blocks the bar's script. See [Security,
the dev toolbar asks the reader to sign
in]({{ '/docs/security/' | relative_url }}#toolbar-requires-sign-in).
