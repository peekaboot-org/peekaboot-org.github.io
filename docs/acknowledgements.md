---
title: Acknowledgements
lead: Peekaboot invented none of this. It stands on prior art other projects built.
permalink: /docs/acknowledgements/
---

## Spring Boot and its OpenTelemetry support

Peekaboot's tracing exists because Spring Boot 4 treats OpenTelemetry as a first-class
citizen: no agent to attach, no collector to run, no sidecar to keep alive. Thank you to
[Spring Boot](https://spring.io/projects/spring-boot) for making that the default rather
than something you assemble yourself.

## Symfony's Web Profiler and Debug Toolbar

[Symfony's profiler and web debug toolbar](https://symfony.com/doc/current/profiler.html)
showed that this category belongs on the page you are already looking at, rather than in a
dashboard you have to remember to open. Peekaboot's toolbar has the shape it has because
Symfony got there first.

## Spring Boot Admin

[Spring Boot Admin](https://github.com/codecentric/spring-boot-admin) was the first to turn
Actuator's endpoints into something a person could read instead of curl and squint at.
Peekaboot's dashboard answers a narrower question, in-process during local development; the
idea that Actuator data deserves a real UI is not its own.

## And everywhere else this category already existed

Most ecosystems had this before the JVM did: [Laravel
Debugbar](https://github.com/fruitcake/laravel-debugbar), [Django Debug
Toolbar](https://django-debug-toolbar.readthedocs.io/),
[rack-mini-profiler](https://github.com/MiniProfiler/rack-mini-profiler) for Ruby, and the
rest of that family. If you came to Peekaboot wanting what one of those gave you, on Spring
Boot instead, that is the gap it fills.
