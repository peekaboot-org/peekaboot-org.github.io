---
title: Agents
lead: How an AI coding agent or a script reads Peekaboot over HTTP.
permalink: /docs/agents/
---

An agent that debugs your application through Peekaboot needs HTTP and nothing else. Everything
the dashboard shows is JSON under `/peekaboot/api`, and the answers carry Peekaboot's own
judgement, such as a trace's cause, its issues and the routes that fail. The agent does not have
to work any of it out again.

## Install the skill {#install-the-skill}

The [peekaboot skill](https://github.com/peekaboot-org/peekaboot-skills) puts these recipes in a
coding agent's own environment. The agent loads it when a task fits, such as a request that
fails, without being pointed at this page. It needs `curl` and `jq`.

Claude Code, in a session:

```text
/plugin marketplace add peekaboot-org/peekaboot-skills
/plugin install peekaboot@peekaboot
```

Or from a shell:

```bash
claude plugin marketplace add peekaboot-org/peekaboot-skills
claude plugin install peekaboot@peekaboot
```

Codex:

```bash
codex plugin marketplace add peekaboot-org/peekaboot-skills
codex plugin add peekaboot@peekaboot
```

Cursor, Gemini CLI and GitHub Copilot read skills from a project's `.agents/skills/`. From your
project's root, clone the skill's repository next to it and copy the skill folder:

```bash
git clone --depth 1 https://github.com/peekaboot-org/peekaboot-skills ../peekaboot-skills
mkdir -p .agents/skills && cp -r ../peekaboot-skills/skills/peekaboot .agents/skills/
```

Claude Code reads a project's skills from `.claude/skills/` instead:

```bash
mkdir -p .claude/skills && cp -r ../peekaboot-skills/skills/peekaboot .claude/skills/
```

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

For an application whose artifact id is `orders`, the application reads the password where it
starts, and the agent reads both credentials from the environment its shell inherits:

```bash
export PEEKABOOT_SECURITY_PASSWORD='a-long-random-secret'   # where the application starts
export PEEKABOOT_USER=orders-admin PEEKABOOT_PASSWORD='a-long-random-secret'   # where the agent runs
curl -s -u "$PEEKABOOT_USER:$PEEKABOOT_PASSWORD" http://localhost:8080/peekaboot/api/features
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

Each recipe shows its first call here. The skill's reference files hold the whole recipe, with
the follow-up calls and what an empty answer means. The calls read the application's scheme,
host, port and context path from `BASE`. Set it first, and add `-u` where the guard is armed:

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

While `complete` is `false` the spans are still arriving; ask again. The [full
recipe](https://github.com/peekaboot-org/peekaboot-skills/blob/main/skills/peekaboot/references/debug-a-500.md)
adds the stack trace and the error digest.

### Find slow or failing routes {#slow-or-failing-routes}

```bash
curl -s "$BASE/peekaboot/api/routes" \
  | jq '.routes | sort_by(-.p95Ms) | .[:5] | map({method, route, count, errorCount, p95Ms, latestSlowTraceId, latestErrorTraceId})'
```

The [full
recipe](https://github.com/peekaboot-org/peekaboot-skills/blob/main/skills/peekaboot/references/slow-or-failing-routes.md)
reads the slowest route's trace, its hotspots and its issues.

### Read health over time {#health-over-time}

```bash
curl -s -G "$BASE/peekaboot/api/insights/data" --data-urlencode 'level=1' | jq '{level, count, problems}'
```

An empty `problems` list means no rule reached its threshold. The [full
recipe](https://github.com/peekaboot-org/peekaboot-skills/blob/main/skills/peekaboot/references/health-over-time.md)
adds the levels and the run history.

### Search the logs {#log-search}

```bash
curl -s -G "$BASE/peekaboot/api/logs" --data-urlencode 'level=WARN' --data-urlencode 'q=timeout' \
  | jq '.logs[] | {timestamp, level, logger, message, traceId}'
```

The [full
recipe](https://github.com/peekaboot-org/peekaboot-skills/blob/main/skills/peekaboot/references/log-search.md)
pages through the results.
