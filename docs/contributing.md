---
title: Contributing
lead: Where the contributor documentation lives.
permalink: /docs/contributing/
---

The contributor documentation lives in the [product repository]({{ site.repository_url }}),
next to the code it describes.

- [`docs/ARCHITECTURE.md`]({{ site.repository_url }}/blob/HEAD/docs/ARCHITECTURE.md): the
  modules and how they work.
- [`docs/GLOSSARY.md`]({{ site.repository_url }}/blob/HEAD/docs/GLOSSARY.md): the terms the
  code and these pages share.
- [`docs/TESTING.md`]({{ site.repository_url }}/blob/HEAD/docs/TESTING.md): how the tests are
  structured and run.
- [`BUILD.md`]({{ site.repository_url }}/blob/HEAD/BUILD.md): building with Maven or Gradle,
  the quality gates, and how a release is cut.

`peekaboot-test-support` only supports the other modules' tests and is never published.

Report bugs and proposals in the [issue tracker]({{ site.repository_url }}/issues). Commit
messages follow [Conventional Commits](https://www.conventionalcommits.org/); the prefix decides
the next version number.

This site has its own repository,
[peekaboot-org.github.io](https://github.com/peekaboot-org/peekaboot-org.github.io). Its README
explains how to preview a change locally.
