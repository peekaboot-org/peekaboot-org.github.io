---
title: Contributing
lead: This site documents what the starter does; how it does it lives with the code.
permalink: /docs/contributing/
---

Everything about Peekaboot's internals &mdash; the modules, the build, the tests and the
open decisions &mdash; is kept next to the source in the [product
repository]({{ site.repository_url }}), so that it changes in the same commit as the code
it describes:

- [`docs/ARCHITECTURE.md`]({{ site.repository_url }}/blob/HEAD/docs/ARCHITECTURE.md)
  &mdash; the modules, how activation and the defaults are wired, the trace store, span
  deduplication, query extraction, the in-process Actuator calls and the persisted state.
- [`BUILD.md`]({{ site.repository_url }}/blob/HEAD/BUILD.md) &mdash; building with Maven
  or Gradle, the static-analysis gates, and how a release is cut.
- [`docs/TESTING.md`]({{ site.repository_url }}/blob/HEAD/docs/TESTING.md) &mdash; how
  the tests are structured and run, and the rules they follow (real collaborators over
  mocks, pristine output, the known flakes).
- [`docs/GLOSSARY.md`]({{ site.repository_url }}/blob/HEAD/docs/GLOSSARY.md) &mdash; the
  terms the code and these pages share.
- [`docs/IMPROVEMENTS.md`]({{ site.repository_url }}/blob/HEAD/docs/IMPROVEMENTS.md)
  &mdash; the decisions still waiting on a call, the known gaps, and what is deliberately
  left alone.

One module in that repository is easy to misread from the outside:
`peekaboot-test-support` is a helper for the other modules' own tests. It builds with the
rest but is never published &mdash; nothing your application depends on comes from it.

Bugs and proposals go to the [issue tracker]({{ site.repository_url }}/issues). Commit
messages follow [Conventional Commits](https://www.conventionalcommits.org/): the next
version number is derived from the commit messages since the last release, so the prefix
you choose decides the version bump.

This site is its own repository,
[peekaboot-org.github.io](https://github.com/peekaboot-org/peekaboot-org.github.io); its
README explains how to preview a change locally.
