---
title: Error page
lead: In place of Spring Boot's whitelabel page, errors show the exception, its message and the stack trace with framework frames folded.
permalink: /docs/error-page/
---

{% include screenshot.html name="error-page" %}

The page shows the status and reason, the request line, the exception class and message, and
the stack trace with your own frames marked. Framework frames fold behind a disclosure, see
[`peekaboot.stack-trace`]({{ '/docs/configuration/' | relative_url }}#peekabootstacktrace). The
page carries the [dev toolbar]({{ '/docs/dev-toolbar/' | relative_url }}#the-bar-on-the-error-page),
which reports the failed request.

{% include facts/error-page-accept.md %}

On a local run, a request that does not come from the machine the application runs on gets the
page with the status and the path only. See [Security, who can reach
Peekaboot]({{ '/docs/security/' | relative_url }}#who-can-reach-peekaboot).

<div class="pk-callout pk-callout--warning" markdown="1">
**The page shows the exception message and stack trace.** Both are masked by value shape only,
and the page sits outside Peekaboot's guard. Turned on for a deployment, anyone who can reach
the application sees them, and the startup report logs a WARN whenever the page is served. See
[Security, what the error page shows]({{ '/docs/security/' | relative_url }}#the-error-page).
</div>

## Turn it on or off {#turn-it-on-or-off}

`peekaboot.error-page.enabled` is on for a [local
run]({{ '/docs/configuration/' | relative_url }}#local-run) and off for a deployment or a test.
It also needs `peekaboot.enabled` and a servlet web application with Spring MVC.
`peekaboot.error-page.override` is `false`. Both are under
[Configuration]({{ '/docs/configuration/' | relative_url }}#peekabooterrorpage).

## When your application has its own error page {#own-error-page}

By default Peekaboot backs off when the application has its own error page: an `error` view
bean, an `error` template or a static `error/*.html`. It also stays off while
`spring.web.error.whitelabel.enabled` is `false`.

## Override your own error page {#override}

To keep a branded error page in production and see Peekaboot's page while developing, set
`peekaboot.error-page.override: true` in your local profile.

- Peekaboot's page wins wherever `enabled` is `true`, including over an `@ControllerAdvice` or
  `@ExceptionHandler` that renders your error page.
- The `Accept` rule above still holds, so API clients keep your application's own error
  response. A request Peekaboot's [HTTP API]({{ '/docs/api/' | relative_url }}#errors) refuses,
  such as one with an unknown query parameter, keeps its `application/problem+json` answer and
  its status for any `Accept` that admits JSON, a browser's included.
- The `spring.web.error.whitelabel.enabled` setting no longer applies.

The page keeps the status Spring would send:

| Case | Status and logging |
|---|---|
| Type mismatch | `400` |
| Method not allowed | `405` with its `Allow` header |
| `ResponseStatusException` | Its status and headers |
| `@ResponseStatus` | Its reason, with its message code resolved |
| An exception Spring maps to nothing, including one your own `@ExceptionHandler` maps | `500`, and `Request processing failed: <exception>` at ERROR |
| `ResponseStatusException` or `@ResponseStatus`, with `spring.mvc.log-resolved-exception=true` | Also logged at WARN |

The override does not work when the application excludes `ErrorMvcAutoConfiguration` or maps its
own `ErrorController` to `/error`.

If the page does not appear, see [Troubleshooting]({{ '/docs/troubleshooting/' | relative_url }}#error-page-not-shown).
