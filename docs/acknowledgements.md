---
title: Acknowledgements
lead: The projects Peekaboot builds on and borrows from.
permalink: /docs/acknowledgements/
---

## Spring Boot and its OpenTelemetry support {#spring-boot-and-its-opentelemetry-support}

Peekaboot's tracing runs on the OpenTelemetry support built into
[Spring Boot](https://spring.io/projects/spring-boot) 4.

## Symfony's Web Profiler and Debug Toolbar {#symfonys-web-profiler-and-debug-toolbar}

The dev toolbar takes its idea and shape from [Symfony's profiler and web debug
toolbar](https://symfony.com/doc/current/profiler.html).

## Spring Boot Admin {#spring-boot-admin}

The dashboard follows [Spring Boot Admin](https://github.com/codecentric/spring-boot-admin) in
giving Actuator's data a readable UI.

## Debug toolbars in other ecosystems {#other-attributions}

Other ecosystems had debug toolbars first, among them [Laravel
Debugbar](https://github.com/fruitcake/laravel-debugbar), [Django Debug
Toolbar](https://django-debug-toolbar.readthedocs.io/) and
[rack-mini-profiler](https://github.com/MiniProfiler/rack-mini-profiler) for Ruby.

## Bundled and pulled-in projects {#bundled-projects}

The Insights charts are drawn with [uPlot](https://github.com/leeoniya/uPlot), under the MIT
License. Peekaboot's UI uses the [Geist and Geist Mono](https://github.com/vercel/geist-font)
fonts, under the SIL Open Font License 1.1. Both ship inside Peekaboot's jar. The
[`NOTICE`]({{ site.repository_url }}/blob/HEAD/NOTICE) file lists their versions and licences.

The starter brings [datasource-micrometer](https://github.com/jdbc-observations/datasource-micrometer),
under the Apache License 2.0. It records the JDBC queries the Traces tab shows.
