---
title: Concepts
lead: The vocabulary the dashboard uses for traces &mdash; what you need to read it, nothing more.
permalink: /docs/concepts/
---

This page defines the words the Traces tab and trace detail overlay use, in the terms
they're shown to you &mdash; not the classes behind them. If you're reading the UI, this
is everything you need.

## Trace

A trace is everything Peekaboot recorded for one unit of work &mdash; one HTTP request,
one run of a scheduled job, one message handled off a queue &mdash; from the moment it
started to the moment it finished. Every trace has an id, shown throughout the UI, that
you can copy and search logs or other tooling with.

## Span

A trace is made of spans: individual units of work inside it. Handling the request itself
is a span; each database query is a span; each outbound call to another service is a
span. Spans nest &mdash; a query span sits inside the handler span that issued it, which
sits inside the request span that triggered the handler &mdash; forming the tree you see
in the trace detail overlay's Spans tab.

## Root span and root operation

The root span is the span at the top of that tree &mdash; the one nothing else is nested
under. It's what makes the trace a trace: an HTTP request's root span is the request
itself; a scheduled job's root span is the job invocation. The **root operation** is that
span's name, shown in the trace list &mdash; typically an HTTP method and path (`GET
/api/orders`) or a job's fully-qualified method name.

## Root action type

The root action type classifies what kind of thing started the trace, used for the icon
next to each row and for filtering the trace list. Peekaboot works this out from the root
span alone, checking a fixed list of rules **in priority order** and stopping at the
first match &mdash; a span that could plausibly fit more than one row always gets the
one checked first, not the most specific-sounding one:

| Priority | Value | Icon | Means | Recognized by |
|---|---|---|---|---|
| 1 | Message Consumer | 📩 | A message picked off a queue or topic | The root span is a consumer-side span, **or** carries messaging details &mdash; checked first, so a consumer-side span whose name happens to contain "job" or "cron" is still Message Consumer, never Scheduled Job |
| 2 | HTTP Request | 🌐 | An inbound web request, recognized from its own tags | The root span is a server-side span **and** carries HTTP details |
| 3 | RPC Call | 🔗 | An inbound remote-procedure call (e.g. gRPC) | The root span is a server-side span **and** carries RPC details |
| 4 | Scheduled Job | 🕐 | A `@Scheduled` method or other timed/cron work | The root span's *name* contains "schedule", "cron", "timer" or "job" (case-insensitive) &mdash; checked only after rows 1&ndash;3 have already ruled themselves out |
| 5 | Database | 🗂 | A database call with nothing above it in the trace | Rare &mdash; means something queried a database with no request, job or message context around it that Peekaboot could see. The root span is a client-side span **and** carries database details |
| 6 | HTTP Request (fallback) | 🌐 | Any other inbound web request that didn't carry HTTP-specific tags | The root span is a server-side span, full stop &mdash; checked last among the server-side rules, after Scheduled Job and Database have both already failed to match |
| 7 | Internal | ⚙ | The trace has no inbound/outbound direction at all | The root span carries none of the roles above (client, server or consumer) |
| 8 | Unknown | ❓ | Nothing above matched | Fallback |

HTTP Request appears twice on purpose: the strict, tag-based check (priority 2) fires
before Scheduled Job and Database are even considered, while the loose fallback (priority
6) only fires after every other rule &mdash; including Scheduled Job's name check &mdash;
has already failed. Both rows produce the same value and the same icon; only the
condition and its position in the list differ.

<div class="pk-callout" markdown="1">
**Scheduled Job is a name match, not a tag, and it's checked in the middle of the list,
not first.** Rows 1&ndash;3 are decided from the root span's own kind and structured
tags and are checked before Scheduled Job ever runs; only once none of them match does
the name-substring check get a turn. In practice this means two jobs that look equally
"scheduled" can classify differently: a job named `task scheduler.fixedDelay` gets the
Scheduled Job icon (its name contains "schedule", and nothing earlier in the list already
matched it), while a job named `task orderReconciler.reconcileOrders` does not &mdash;
nothing in that name matches, and with no HTTP/RPC/messaging/database tags on its root
span either, it falls through all the way to Internal instead. Both are real `@Scheduled`
methods; only the name, and where the check for it sits in the list, decides which icon
they get.
</div>

## Trace status

A trace's status is one of exactly two values: **OK**, or **HAS_ERRORS** if any span in
the trace ended with an error. There is no third, "slow" status &mdash; slowness is
tracked separately, as an issue (below) and as the Slow bucket, not as a trace status.

## Issues

An issue is a problem Peekaboot detected on a specific span, shown as a coloured marker
in the span tree. Each type has a default threshold you can change &mdash; see
[Configuration]({{ '/docs/configuration/' | relative_url }}) for the exact property
names:

| Type | Fires when | Default threshold |
|---|---|---|
| SLOW | A span's own duration reaches the slow-span threshold | 100ms |
| VERY_SLOW | A span's own duration reaches the very-slow threshold (checked first &mdash; a span gets this or SLOW, never both) | 500ms |
| ERROR | A span ended with an error | &mdash; |
| SLOW_QUERY | A database query span's duration reaches the slow-query threshold | 50ms |
| HIGH_QUERY_COUNT | Either: one span has more direct database-query children than the per-span threshold, or the whole trace ran more database queries in total than the per-trace threshold | 5 queries (per span) / 20 queries (per trace) |

See [Tracing]({{ '/docs/tracing/' | relative_url }}) for the SLOW *badge* you'll see on a
trace row in the list &mdash; it's built from this same SLOW/VERY_SLOW issue check, which
is a different, much smaller threshold than the one that puts a trace in the Slow
*bucket*.
