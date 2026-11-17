A request the guard refuses gets a `401` with the challenge `WWW-Authenticate: Basic
realm="Peekaboot", charset="UTF-8"` and a [problem
body]({{ '/docs/api/' | relative_url }}#errors) saying which credentials it needs.

An include cannot set the status, so a request your application includes into the dashboard
keeps its own response.
