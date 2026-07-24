# Step 0 — Freeze the reasoning fixture baseline

Complete the three repository-readiness actions that were previously loose pre-execution work. This
step changes no Layer A/C behavior and creates no reasoning runtime code.

1. Verify `cowork-p2-kit/store/records.jsonl.bak` is byte-identical to the canonical
   `store/records.jsonl`, then move the backup out of `store/` into recoverable session artifacts.
   Do not delete a non-identical backup.
2. Copy the current 17 F-01/F-02/F-03 records byte-for-byte to
   `cowork-p2-kit/reasoning/tests/fixtures/store/records.jsonl`. Add a fixture README recording the
   source ingest run/date, source path, record count, and SHA-256. Synthetic inadmissible records are
   Step 2 work, not part of this baseline copy.
3. Set `pins.store_records_sha256` in `gates.yaml` to the shared source/snapshot SHA-256. This is a
   reproducibility pin produced by Step 0; unlike rubric and attestation approval pins, it does not
   claim human or FD authenticity. Any later repin requires `store_records_repin_reason`.

## Completion checkpoint

- the unmanaged `.bak` no longer sits beside the canonical store;
- the committed snapshot has 17 records and hashes byte-identically to its recorded source;
- the fixture README and `gates.yaml` contain the same SHA-256; and
- `git diff --name-only` is confined to the Step 0 paths above plus the recoverable artifact move.

Step 0 is setup rather than product behavior, so it has a checklist checkpoint rather than a
`G-P4-*` runtime gate. Step 1 may begin only after this checkpoint is reviewed.
