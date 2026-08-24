---
title: Acknowledgements
lead: Peekaboot didn't invent any of this. It stands on infrastructure and prior art built by other projects, and it's a better tool because of them.
permalink: /docs/acknowledgements/
---

## Spring Boot and its OpenTelemetry support

Peekaboot's tracing exists because Spring Boot 4.x treats OpenTelemetry as a first-class
citizen. For you, that means the trace view on your own pages needs nothing standing next
to your application &mdash; no agent to attach, no collector to run, no sidecar to deploy
and keep alive. Add the dependency, run your app, and the spans are already there. Thank
you to [Spring Boot](https://spring.io/projects/spring-boot) for making that the default
rather than something you have to assemble yourself.

## Symfony's Web Profiler and Debug Toolbar

Long before Peekaboot, [Symfony's profiler and web debug
toolbar](https://symfony.com/doc/current/profiler.html) showed that a toolbar docked to
the page you're already looking at &mdash; not a separate dashboard you have to remember
to open &mdash; is how this category should work. That shape is the reason Peekaboot's own
toolbar looks the way it does.

## Spring Boot Admin

[Spring Boot Admin](https://github.com/codecentric/spring-boot-admin) was the first to
turn Actuator's endpoints into something a person could actually read, rather than JSON
you'd curl and squint at. Peekaboot's dashboard answers a narrower question, in-process
during local development, but the idea that Actuator data deserves a real UI isn't new
&mdash; Spring Boot Admin got there first.

## And everywhere else this category already existed

Most ecosystems had this before the JVM did: [Laravel
Debugbar](https://github.com/fruitcake/laravel-debugbar), [Django Debug
Toolbar](https://django-debug-toolbar.readthedocs.io/), [rack-mini-profiler](https://github.com/MiniProfiler/rack-mini-profiler)
for Ruby, and the rest of that family. If you've reached for Peekaboot because you wanted
what one of those already gave you, on Spring Boot instead &mdash; that's exactly the gap
it's meant to fill.
