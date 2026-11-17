---
title: Agents
lead: How an AI coding agent or a script reads Peekaboot over HTTP.
permalink: /docs/agents/
---

An agent that debugs your application through Peekaboot needs HTTP and nothing else. Everything
the dashboard shows is JSON under `/peekaboot/api`, with Peekaboot's own verdicts such as a
trace's cause, its issues and the routes that fail.

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

`GET /peekaboot/api` lists every endpoint and links the OpenAPI document. See [HTTP
API]({{ '/docs/api/' | relative_url }}#openapi).

```bash
curl -s http://localhost:8080/peekaboot/api | jq
```

## Authentication {#authentication}

On a [local run]({{ '/docs/configuration/' | relative_url }}#local-run) the API needs no
credentials and answers only the machine the application runs on. An agent on another host
needs an SSH tunnel to that machine or `peekaboot.remote-access.enabled=true`. See [Security,
who can reach Peekaboot]({{ '/docs/security/' | relative_url }}#who-can-reach-peekaboot).

Where [Peekaboot's guard]({{ '/docs/security/' | relative_url }}#peekaboots-guard) is armed,
every request needs HTTP Basic credentials:

{% include facts/guard-credentials.md %}

Set the password, so the agent can know it without reading the startup log. For an
application whose artifact id is `orders`, the application reads the password where it starts,
and the agent reads both credentials from the environment its shell inherits:

```bash
export PEEKABOOT_SECURITY_PASSWORD='a-long-random-secret'   # where the application starts
export PEEKABOOT_USER=orders-admin PEEKABOOT_PASSWORD='a-long-random-secret'   # where the agent runs
curl -s -u "$PEEKABOOT_USER:$PEEKABOOT_PASSWORD" http://localhost:8080/peekaboot/api/features
```

Where your own Spring Security guards `/peekaboot/**` instead, send the credentials it expects.
For refused requests, see [Security]({{ '/docs/security/' | relative_url }}).

## Masked values {#masked-values}

`******` means Peekaboot masked a value. It is never the real value, so do not use it, retry for
it or report it as empty. `/peekaboot/api/features` names it in `maskLiteral`, and the log search
finds lines that held one with `q=******`. See [Security,
masking]({{ '/docs/security/' | relative_url }}#masking).

## Recipes {#recipes}

Each recipe shows its first call. `BASE` is the application's scheme, host, port and context
path. Add `-u` where the guard is armed:

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

While `complete` is `false` the spans are still arriving; ask again.

[Full recipe](https://github.com/peekaboot-org/peekaboot-skills/blob/HEAD/skills/peekaboot/references/debug-a-500.md)

### Find slow or failing routes {#slow-or-failing-routes}

```bash
curl -s "$BASE/peekaboot/api/routes" \
  | jq '.routes | sort_by(-.p95Ms) | .[:5] | map({method, route, count, errorCount, p95Ms, latestSlowTraceId, latestErrorTraceId})'
```

[Full recipe](https://github.com/peekaboot-org/peekaboot-skills/blob/HEAD/skills/peekaboot/references/slow-or-failing-routes.md)

### Read health over time {#health-over-time}

```bash
curl -s -G "$BASE/peekaboot/api/insights/data" --data-urlencode 'level=1' | jq '{level, count, problems}'
```

An empty `problems` list means no rule reached its threshold.

[Full recipe](https://github.com/peekaboot-org/peekaboot-skills/blob/HEAD/skills/peekaboot/references/health-over-time.md)

### Search the logs {#log-search}

```bash
curl -s -G "$BASE/peekaboot/api/logs" --data-urlencode 'level=WARN' --data-urlencode 'q=timeout' \
  | jq '.logs[] | {timestamp, level, logger, message, traceId}'
```

[Full recipe](https://github.com/peekaboot-org/peekaboot-skills/blob/HEAD/skills/peekaboot/references/log-search.md)
