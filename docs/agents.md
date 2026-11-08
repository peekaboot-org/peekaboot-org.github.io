---
title: Agents
lead: How an AI coding agent or a script reads Peekaboot over HTTP.
permalink: /docs/agents/
---

An agent that debugs your application through Peekaboot needs HTTP and nothing else. Everything
the dashboard shows is JSON under `/peekaboot/api`, and the answers carry Peekaboot's own
judgement, such as a trace's cause, its issues and the routes that fail. The agent does not have
to work any of it out again.

## Start here {#start-here}

`GET /peekaboot/api` lists every endpoint with one line on what it is for, and links the
OpenAPI document:

```bash
curl -s http://localhost:8080/peekaboot/api | jq
```

`/peekaboot/api/openapi.json` is an OpenAPI 3.1 document. It describes every endpoint, parameter,
response and problem body Peekaboot answers with. An error your application answers instead,
such as a `405`, appears there in words only.

The document's `servers` entry is the prefix the request came through, so a context path or a
`spring.mvc.servlet.path` prefix is already in it. See [HTTP
API]({{ '/docs/api/' | relative_url }}#openapi).

An endpoint refuses a parameter it does not take with a `400` whose `detail` lists the ones it
does take. A typo never returns the unfiltered list.

## Authentication {#authentication}

On a [local run]({{ '/docs/configuration/' | relative_url }}#local-run) the API needs no
credentials. Where [Peekaboot's guard]({{ '/docs/security/' | relative_url }}#peekaboots-guard)
is armed, every request needs HTTP Basic credentials:

- **Username:** `peekaboot.security.username`, else your build's artifact id plus `-admin`,
  else `spring.application.name` plus `-admin`, else `peekaboot-admin`.
- **Password:** set one the agent can know, with `peekaboot.security.password` or the
  environment variable `PEEKABOOT_SECURITY_PASSWORD`. Otherwise Peekaboot generates one and
  prints it once, in the startup log's `Peekaboot Security` block. It survives a restart only
  where Peekaboot can store its hash, with storage on or `peekaboot.security.credentials-file`
  set. Without either, each start generates a new one.

For an application whose artifact id is `orders`:

```bash
export PEEKABOOT_SECURITY_PASSWORD='a-long-random-secret'   # where the application starts
curl -s -u "orders-admin:$PEEKABOOT_SECURITY_PASSWORD" http://localhost:8080/peekaboot/api/features
```

A refused request answers `401` with a problem body. Where your own Spring Security guards
`/peekaboot/**` instead, send the credentials it expects.

## Masked values {#masked-values}

`******` means Peekaboot masked a value. The value exists, and the API does not show it. It is
never the real value, so an agent should not use it, retry for it, or report it as empty.
A masked part can sit inside a longer string, such as `jdbc:postgresql://db/orders?password=******`.
`/peekaboot/api/features` names the literal in `maskLiteral`.

The log search matches the masked text, so `q=******` finds the lines Peekaboot masked a value in.
Only `/peekaboot/api/actuator/all/insights?unmask=true` shows real values, and only while
`peekaboot.unmasking.enabled` is on. See [Security,
masking]({{ '/docs/security/' | relative_url }}#masking).

## Recipes {#recipes}

The recipes use `curl` and `jq`, and each reads the application's address from `BASE`. Set it
first, and add `-u` where the guard is armed:

```bash
BASE=http://localhost:8080
```

### Debug a 500 {#debug-a-500}

A response from your application names its trace in a `Server-Timing` header. Read the trace
and its cause:

```bash
T=$(curl -s -D - -o /dev/null "$BASE/orders/42" | grep -i '^server-timing' | sed -nE 's/.*00-([0-9a-f]{32})-.*/\1/p')
if [ -z "$T" ]; then echo 'No Server-Timing header, so Peekaboot did not trace this request.'
else curl -s "$BASE/peekaboot/api/traces/$T" | jq '.summary | {complete, outcome, cause, reasons}'; fi
```

`cause` names the exception, its message and the application frame it came from. While
`complete` is `false` the spans are still arriving; ask again. The stack trace is on the span
`cause.spanId` names:

```bash
if [ -n "$T" ]; then curl -s "$BASE/peekaboot/api/traces/$T" \
  | jq -r '.summary.cause.spanId as $s | .data.rootSpan | .. | objects | select(has("children") and .spanId == $s) | .exception.stackTrace'; fi
```

A cause found in an ERROR log has its stack trace on that log line instead, under
`.data.logs`. For failures you did not trigger yourself, the error digest lists every one the
traces showed, seen latest first:

```bash
curl -s "$BASE/peekaboot/api/errors" | jq '.errors[:5] | map({type, route, count, lastMessage, lastTraceId, traceAvailable})'
```

Fetch a `lastTraceId` as a trace while its `traceAvailable` is `true`.

### Find slow or failing routes {#slow-or-failing-routes}

```bash
curl -s "$BASE/peekaboot/api/routes" \
  | jq '.routes | sort_by(-.p95Ms) | .[:5] | map({method, route, count, errorCount, p95Ms, latestSlowTraceId, latestErrorTraceId})'
```

Fetch the `latestSlowTraceId` of the route with the highest `p95Ms` that has one, as a trace.
Its `summary.hotspots` names the spans that spent the longest on their own work, and
`summary.issues` every issue on its spans, such as slow spans, slow queries and repeated queries:

```bash
T=$(curl -s "$BASE/peekaboot/api/routes" | jq -r '[.routes[] | select(.latestSlowTraceId)] | max_by(.p95Ms) | .latestSlowTraceId // empty')
if [ -z "$T" ]; then echo 'No route has a slow trace.'
else curl -s "$BASE/peekaboot/api/traces/$T" | jq '.summary | {durationMs, hotspots, issues: [.issues[] | {type, message}]}'; fi
```

### Read health over time {#health-over-time}

The insights data summarises each metric over a window and names the problems it shows, such
as CPU running high or connections waiting for the pool:

```bash
curl -s "$BASE/peekaboot/api/insights/config" | jq '.levels'
curl -s -G "$BASE/peekaboot/api/insights/data" --data-urlencode 'level=1' \
  --data-urlencode 'since=2026-11-07T09:00:00Z' | jq '{level, count, problems}'
```

An empty `problems` list means no rule reached its threshold. A rule whose series has no
samples in the window is left out of `problems`. Restarts and deployments are in the run history:

```bash
curl -s "$BASE/peekaboot/api/lifecycle/runs" | jq '.runs[:3] | map({startedAt, uncleanExit, changed})'
```

### Search the logs {#log-search}

```bash
curl -s -G "$BASE/peekaboot/api/logs" --data-urlencode 'level=WARN' --data-urlencode 'q=timeout' \
  | jq '.logs[] | {timestamp, level, logger, message, traceId}'
```

The search covers the lines inside traces and the ones outside them, newest first. A line with
a `traceId` leads to its trace. A page's `next` is the page token for the one after it. Send it
back as `cursor` with the same filters. On the last page `next` is `null`:

```bash
NEXT=$(curl -s -G "$BASE/peekaboot/api/logs" --data-urlencode 'level=WARN' | jq -r '.next // empty')
if [ -z "$NEXT" ]; then echo 'That was the last page.'
else curl -s -G "$BASE/peekaboot/api/logs" --data-urlencode 'level=WARN' --data-urlencode "cursor=$NEXT"; fi
```
