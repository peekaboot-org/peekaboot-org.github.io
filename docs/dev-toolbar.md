---
title: Dev toolbar
lead: A bar at the bottom of every HTML page your app renders, with the request, its trace and its logs.
permalink: /docs/dev-toolbar/
---

{% include screenshot.html name="toolbar-collapsed" %}

The bar shows the response status, method and path, controller method, duration, span count,
query count and total query time, log count, error and warning log counts when there are any,
and the trace id, which copies on click. The logo opens the dashboard in a new tab. Click
anywhere else on the bar, or press Enter or Space while it has focus, to open the trace detail
on top of your page. It is the one the dashboard's Traces tab uses, see
[Traces]({{ '/docs/traces/' | relative_url }}#the-trace-view).

The numbers fill in during the first few seconds, so spans that end after the response are
counted too.

## Turn it on or off {#turn-it-on-or-off}

The toolbar needs:

- `peekaboot.enabled=true` and `peekaboot.dev-toolbar.enabled=true`. Both default to true only for a
  [local run]({{ '/docs/configuration/' | relative_url }}#local-run).
- `peekaboot.tracing.enabled`, `true` by default, for the trace, request details and logs the
  bar shows.
- A servlet web application.
- A Micrometer `Tracer` bean, which the starter provides. Without one the toolbar is absent, see
  [Production use]({{ '/docs/in-production/' | relative_url }}#graceful-degradation).

```yaml
peekaboot:
  dev-toolbar:
    enabled: false
```

`peekaboot.dev-toolbar.enabled` is under [Configuration]({{ '/docs/configuration/' | relative_url }}#peekaboot).
While the bar is on, Peekaboot sets the span export delay to 200 ms (Spring Boot's default is
5 s). See [Spring Boot defaults Peekaboot
changes]({{ '/docs/configuration/' | relative_url }}#what-peekaboot-sets-in-your-application).

## Pages that get the bar {#where-the-bar-appears}

A response gets the bar when its content type is `text/html` and it contains `</body>`. It
does not get the bar when:

- The path starts with one of the prefixes Peekaboot never records. See [Traces, what gets
  recorded]({{ '/docs/traces/' | relative_url }}#what-gets-captured).
- The path ends in `.css`, `.js`, `.ico`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.woff`,
  `.woff2`, `.ttf` or `.eot`.
- The request sends `X-Requested-With: XMLHttpRequest`. A plain `fetch()` does not send it,
  so HTML fetched that way gets the bar.
- The handler responds asynchronously.
- The response is partial content (status `206`). It is served unchanged.
- On a local run, the request does not come from the machine the application runs on. See
  [Security, who can reach Peekaboot]({{ '/docs/security/' | relative_url }}#who-can-reach-peekaboot).

HTML error pages get the bar too, see [the bar on the error page](#the-bar-on-the-error-page).

HTML responses up to 2 MiB are buffered in memory so the bar can be added; larger pages stream
through without it. If generating the bar fails, the page is served unchanged. Your page's CSS
does not affect the bar.

## Request and response detail {#request-and-response-detail}

The Request tab of the trace detail shows the method, path, query string, status, duration,
controller method, query and form parameters, and the request and response headers.

Headers and parameters are masked on the server, by key name and by value patterns. There is
no reveal control, so a masked value stays masked. See
[Security]({{ '/docs/security/' | relative_url }}#masking) for the rules and what they miss.
Request bodies and uploaded file names are not captured.

Form parameters appear only when your application, or a later filter such as Spring Security's
CSRF check, read them. A request rejected before anything read its parameters shows none. A name or value over 4,096 characters is cut.

## Logs for the request {#logs-correlated-to-the-request}

The Logs tab lists every log line your app wrote while handling the request, with timestamp,
level, message and the active span.

<div class="pk-callout pk-callout--warning" markdown="1">
**Log lines are masked by value shape only.** A log line is stored as written, and only the
credentials a value pattern recognises are masked when it is shown. Other secrets and personal
data appear as is. See [Security]({{ '/docs/security/' | relative_url }}#what-gets-masked-and-how)
for the patterns and what tracing exposes.
</div>

## Swagger UI {#it-also-works-from-swagger-ui}

On the Swagger UI page the bar starts idle with "Waiting for request…". Run an operation with
"Try it out" and the bar shows that call's status, duration and query count. Click it for the
trace detail.

This works for any traced call, JSON APIs included. Swagger UI's own calls, under its UI path
(`springdoc.swagger-ui.path`) and under `springdoc.api-docs.path`, are not shown. Peekaboot
follows both properties when you customise them. Calls to the [paths Peekaboot never
records]({{ '/docs/traces/' | relative_url }}#what-gets-captured) are not shown either.

## The bar on the error page {#the-bar-on-the-error-page}

HTML error pages get the bar, including [Peekaboot's error
page]({{ '/docs/error-page/' | relative_url }}). It reports the request
that failed. A request that Spring Security
rejects before it reaches your application, such as a 401 or 403, gets no bar on its error
page.

{% include screenshot.html name="error-page" %}

## With Spring Security {#with-spring-security}

The bar loads its data from `/peekaboot/**`. A reader who is not allowed there, or a
Content-Security-Policy that blocks the bar's script, sees a "could not start" notice. See
[Security]({{ '/docs/security/' | relative_url }}#toolbar-requires-sign-in).
