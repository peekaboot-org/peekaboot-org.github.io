---
title: Contributing
lead: This site documents what the starter does; how it does it lives with the code.
permalink: /docs/contributing/
---

Peekaboot's internals are documented next to the source in the [product
repository]({{ site.repository_url }}), so they change in the same commit as the code they
describe.

- [`docs/ARCHITECTURE.md`]({{ site.repository_url }}/blob/HEAD/docs/ARCHITECTURE.md): the
  modules, how activation and the defaults are wired, the trace store, span deduplication,
  query extraction, the in-process Actuator calls and the persisted state.
- [`BUILD.md`]({{ site.repository_url }}/blob/HEAD/BUILD.md): building with Maven or
  Gradle, the nine gates a build has to clear, and how a release is cut.
- [`docs/TESTING.md`]({{ site.repository_url }}/blob/HEAD/docs/TESTING.md): how the tests
  are structured and run, and the rules they follow (real collaborators over mocks,
  pristine output, and the third-party warnings and deliberate demo logging that count as
  accepted noise).
- [`docs/GLOSSARY.md`]({{ site.repository_url }}/blob/HEAD/docs/GLOSSARY.md): the terms the
  code and these pages share.

Open decisions and deliberate gaps are not collected in one place. Each sits beside the
mechanism it constrains, in `ARCHITECTURE.md` or `TESTING.md`.

One module is easy to misread from the outside. `peekaboot-test-support` is a helper for
the other modules' own tests. It builds with the rest and is never published, so nothing
your application depends on comes from it.

Bugs and proposals go to the [issue tracker]({{ site.repository_url }}/issues). Commit
messages follow [Conventional Commits](https://www.conventionalcommits.org/): the next
version number is derived from the messages since the last release, so the prefix you
choose decides the version bump.

This site is its own repository,
[peekaboot-org.github.io](https://github.com/peekaboot-org/peekaboot-org.github.io); its
README explains how to preview a change locally.
