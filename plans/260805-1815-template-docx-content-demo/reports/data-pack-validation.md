# Demo data-pack validation

Date: 2026-08-06

Command:

```text
node --test cowork-p2-kit/workflow-trial/tests/content-demo.test.mjs
```

Relevant result: pass, including store binding, rationale binding, render, and
fail-closed contract assertions.

The run-owned pack contained 23 records: 21 records from the real filled mock
ingest plus two deterministic comparator records. The comparator records and
cards were written only to the temporary run store and carry the
`demo-comparator` marker. The canonical `cowork-p2-kit/store` remained
unchanged.

Receipt joining was exact and ambiguity-rejecting. It binds the canonical
augmented-store SHA-256 and records the matched substring's page-relative
offset; repeated occurrences or multiple records are rejected as ambiguous:

```text
exact: 3
ambiguous: 0
unmapped: 2
```

Only the three exact entries became citation envelopes. The two unmapped
entries retained null record, location, and excerpt fields. Each rendered
citation uses the real ingest record's source, page/offset location, and exact
receipt substring; `evidenceLink` is null. The `citable:true` classification is
confined to these three demo presentation envelopes, while the source mock
remains `citable:false` in its ingest classification.

The approved rubric pin matched the canonical rubric bytes, both candidates had
admitted cards for the two critical measures, and the existing decision engine
computed the selected result.
