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
span's raw name (`rootSpanData.name()`), shown in the trace list exactly as the
instrumentation that created the span wrote it &mdash; lowercase, and not reformatted by
Peekaboot: `http get /orders`, `http get /api/orders/{id}/report`, or, for a `@Scheduled`
method, `task orderReconciler.reconcileOrders`.

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
| 4 | Scheduled Job | 🕐 | A `@Scheduled` method Spring's scheduler actually fired | The root span carries **both** the `code.function` and `code.namespace` tags &mdash; the exact pair Spring's own `DefaultScheduledTaskObservationConvention` sets, and only when its scheduler dispatches the call &mdash; checked only after rows 1&ndash;3 have already ruled themselves out |
| 5 | Database | 🗂 | A database call with nothing above it in the trace | Rare &mdash; means something queried a database with no request, job or message context around it that Peekaboot could see. The root span is a client-side span **and** carries database details |
| 6 | HTTP Request (fallback) | 🌐 | Any other inbound web request that didn't carry HTTP-specific tags | The root span is a server-side span, full stop &mdash; checked last among the server-side rules, after Scheduled Job and Database have both already failed to match |
| 7 | Internal | ⚙ | The trace has no inbound/outbound direction at all | The root span carries none of the roles above (client, server or consumer) |
| 8 | Unknown | ❓ | Nothing above matched | Fallback |

HTTP Request appears twice on purpose: the strict, tag-based check (priority 2) fires
before Scheduled Job and Database are even considered, while the loose fallback (priority
6) only fires after every other rule &mdash; including Scheduled Job's own check &mdash;
has already failed. Both rows produce the same value and the same icon; only the
condition and its position in the list differ.

<div class="pk-callout" markdown="1">
**Scheduled Job is keyed on Spring's own tag pair, not the trace's own instrumentation
class, and it only recognizes a `@Scheduled` method Spring's scheduler actually invoked.**
`code.function`/`code.namespace` are set by
`DefaultScheduledTaskObservationConvention`, and *only* when Spring's
`TaskScheduler` dispatches a `@Scheduled` method &mdash; not by name, not by bean type. Two
consequences follow directly from that:

- **A scheduler Spring doesn't instrument isn't recognized as Scheduled Job at all.**
  Quartz, a raw `ScheduledExecutorService`, or any other timer mechanism that doesn't go
  through Spring's own `@Scheduled` machinery carries neither tag, so its root span falls
  through to Internal (or whatever else its own tags happen to match) &mdash; the trade-off
  accepted deliberately in exchange for no false positives from a bean or method that
  merely has "job", "cron" or "timer" in its name.
- **A *direct* call to a `@Scheduled` method doesn't count either.** Calling
  `orderReconciler.reconcileOrders()` directly &mdash; from a test, or from other
  application code &mdash; never goes through Spring's scheduler, so
  `DefaultScheduledTaskObservationConvention` never runs and the tag pair is never set. If
  the method is also `@Observed`, that aspect's own span carries `class`/`method` tags
  instead, which nothing above recognizes either &mdash; the trace classifies Internal, not
  Scheduled Job, even though the method genuinely is `@Scheduled`. Only a call Spring's own
  scheduler dispatches gets the Scheduled Job icon.
</div>

## Trace status

A trace's status is one of exactly two values: **OK**, or **HAS_ERRORS** if any span in
the trace ended with an error. There is no third, "slow" status &mdash; slowness is
tracked separately, as an issue (below) and as the Slow bucket, not as a trace status.

## Issues

An issue is a problem Peekaboot detected on a specific span, shown as a coloured marker
in the span tree. Each type has a default threshold you can change &mdash; see
[Configuration]({{ '/docs/configuration/' | relative_url }}) for the exact property
names and current default values:

| Type | Fires when |
|---|---|
| SLOW | A span's own duration reaches the slow-span threshold |
| VERY_SLOW | A span's own duration reaches the very-slow threshold (checked first &mdash; a span gets this or SLOW, never both) |
| ERROR | A span ended with an error |
| SLOW_QUERY | A database query span's duration reaches the slow-query threshold |
| HIGH_QUERY_COUNT | Either: one span has more direct database-query children than the per-span threshold, or the whole trace ran more database queries in total than the per-trace threshold |

See [Tracing]({{ '/docs/tracing/' | relative_url }}) for the SLOW *badge* you'll see on a
trace row in the list &mdash; it's built from this same SLOW/VERY_SLOW issue check, which
is a different, much smaller threshold than the one that puts a trace in the Slow
*bucket*.
