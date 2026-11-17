On a local run Peekaboot also writes what it records to
`${user.home}/.peekaboot/<groupId>.<artifactId>/`, so traces survive a restart. The trace files
hold span attributes, SQL with its bind parameters, log messages and stack traces unmasked. See
[Security, what goes to disk]({{ '/docs/security/' | relative_url }}#what-peekaboot-writes-to-disk).

- `peekaboot.storage.traces.enabled=false` keeps traces in memory only.
- `peekaboot.storage.enabled=false` writes nothing.
