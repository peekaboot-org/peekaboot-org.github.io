In the worst case the trace store holds 1,000 traces in All plus up to 200 that only Errors or
Slow still keep, each with 500 spans and 500 log lines: about 1.2 million entries, plus 1,000
log lines written outside any trace, and each log line and each failed span can carry a stack
trace of up to 1,000 lines.

With [traces kept across restarts]({{ '/docs/traces/' | relative_url }}#persisted-traces),
folding the journal replays the files into a second store, so while a fold runs the peak is
about twice that.
