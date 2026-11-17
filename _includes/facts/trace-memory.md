The trace store is bounded by these caps. The worst case is their product:

| Cap | Value |
|---|---|
| Traces held | 1,000 in All, plus up to 200 that only Errors or Slow still keep |
| Per trace | 500 spans and 500 log lines |
| Worst case in total | about 1.2 million entries, plus 1,000 log lines written outside any trace |
| Stack trace on a log line or failed span | up to 1,000 lines |

With [traces kept across restarts]({{ '/docs/traces/' | relative_url }}#persisted-traces),
memory use is about double while the persisted traces are compacted.
