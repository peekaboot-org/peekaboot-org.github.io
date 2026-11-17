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
  response.
- The `spring.web.error.whitelabel.enabled` setting no longer applies.

The page keeps the status Spring would send:

| Case | Status |
|---|---|
| Type mismatch | `400` |
| Method not allowed | `405` |
| `ResponseStatusException` or `@ResponseStatus` | Its own status |
| Any other exception | `500` |

If the page does not appear, see [Troubleshooting]({{ '/docs/troubleshooting/' | relative_url }}#error-page-not-shown).
