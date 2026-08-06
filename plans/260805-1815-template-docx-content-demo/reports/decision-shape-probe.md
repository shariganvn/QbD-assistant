# Decision shape probe

Date: 2026-08-06

Command:

```text
node --test cowork-p2-kit/workflow-trial/tests/decision-shape-probe.test.mjs
```

Result: pass, 2 tests.

The approved and pinned rubric reaches `selected` with two eligible candidates:

- winner: `demo-real-candidate`
- comparator: `demo-comparator`
- matrix cells: 4
- candidate reviews: 2
- sensitivity stable winner: `demo-real-candidate`
- comparator evidence source: `inputs/demo-comparator/records.jsonl`

The probe also preserves the existing fail-closed rubric boundaries:

- proposal rubric: `E_RUBRIC_APPROVAL_REQUIRED`
- missing pin: `E_RUBRIC_PIN_REQUIRED`
- mismatched pin: `E_RUBRIC_PIN_MISMATCH`

The probe confirms that selection returns structured decision/evaluation data;
selected prose is authored later from the sealed rationale packet.
