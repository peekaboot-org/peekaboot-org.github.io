---
title: Error page
lead: In place of Spring Boot's whitelabel page, errors show the exception, its message and the stack trace with framework frames folded.
permalink: /docs/error-page/
---

{% include screenshot.html name="error-page" %}

The page shows the status and reason, the request line, the exception class and message, and
the stack trace with your own frames marked. Framework frames fold behind a disclosure, as
[`peekaboot.stack-trace`]({{ '/docs/configuration/' | relative_url }}#peekabootstacktrace)
decides. The page carries the [dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}#the-bar-on-the-error-page),
which reports the failed request.

Only a request whose `Accept` header names `text/html` gets the page. Swagger UI, curl and
`fetch()` send `*/*` and get Spring Boot's usual error response.

## Turn it on or off {#turn-it-on-or-off}

`peekaboot.error-page.enabled` turns it on for a [local
run]({{ '/docs/configuration/' | relative_url }}#local-run) and off for a deployment or a test.
It also needs `peekaboot.enabled` and a servlet web application with Spring MVC. The properties
are under [Configuration]({{ '/docs/configuration/' | relative_url }}#peekabooterrorpage).

The page is not masked and sits outside Peekaboot's guard. Read [Security, what the error page
shows]({{ '/docs/security/' | relative_url }}#the-error-page) before you turn it on for a
deployment.

## When your application has its own error page {#own-error-page}

By default Peekaboot backs off when the application has its own error page: an `error` view
bean, an `error` template or a static `error/*.html`. It also stays off while
`spring.web.error.whitelabel.enabled` is `false`.

## Override your own error page {#override}

To keep a branded error page in production and see Peekaboot's page while developing, set
`peekaboot.error-page.override: true` in your local profile. Peekaboot's page then wins wherever
`enabled` is `true`. It also wins over an `@ControllerAdvice` or `@ExceptionHandler` that
renders your error page, and the whitelabel setting no longer applies. The `Accept` rule above
still holds, so API clients keep your application's own error response.

With the override on, the page keeps the status, headers and reason Spring would send: `400`
for a type mismatch, `405` with its `Allow` header, the headers of a `ResponseStatusException`,
and an `@ResponseStatus` reason with its message code resolved. An exception Spring maps to
nothing renders as `500` and logs `Request processing failed: <exception>` at ERROR, the line
the servlet container would have logged. That includes an exception your own
`@ExceptionHandler` maps, since the override answers first. With
`spring.mvc.log-resolved-exception=true`, a `ResponseStatusException` or an exception carrying
`@ResponseStatus` also logs at WARN, as Spring's own resolver logs it. A response already
committed is left alone.

If the page does not appear, see [Troubleshooting]({{ '/docs/troubleshooting/' | relative_url }}#error-page-not-shown).
