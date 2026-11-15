A request the guard refuses gets a `401` with the challenge `WWW-Authenticate: Basic
realm="Peekaboot", charset="UTF-8"` and a [problem
body]({{ '/docs/api/' | relative_url }}#errors) saying which credentials it needs. A `401` your
own Spring Security sends first is its own, without Peekaboot's realm or body.

A request your application includes into the dashboard gets nothing from it. An include cannot
set the status, so the including response keeps its own.
