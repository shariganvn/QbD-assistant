# QbD P.2 ingest completion — Step 1 progress

Date: 2026-07-20

## Status

| Metric | Result |
|---|---:|
| Steps completed | 1 / 5 (20%) |
| Gates passed | 2 / 12 |
| Focused tests | 5 / 5 passed |
| Real ingest records | 17 |
| Code-review score | 9.5 / 10 |

## Completed

- Moved executable ingest behavior from ignored `store/` into tracked `ingest/` source.
- Preserved `npm run ingest`, its zero/nonzero exit contract, and byte-identical JSONL output.
- Froze representative record fields, deterministic IDs, paths, offsets, order, and snapshot bytes.
- Retained readable G-01 and G-02 evidence under `artifacts/qbd-p2-ingest-completion/gates/`.

## Verification

- G-01: 2 / 2 tests passed.
- G-02: 3 / 3 tests passed.
- `npm run verify:ingest`: 5 / 5 tests passed with no skips.
- `npm run ingest`: exit 0; store hash remained
  `6a16599838b8335e58f4e4f985c78d089cdd55e1a9b11696d240414b2fc28c56`.
- GitNexus pre-change risk: LOW; zero affected execution flows indexed.
- Independent review: no critical issue, regression, side effect, or public-contract break.

## Known limitations

- Draft-07 validation is not yet executed by a dedicated validator; the contract test pins the
  reviewed snapshot plus required fields and relevant enums.
- `lit is-complex` is unavailable in the installed CLI; current ingest logs a warning and continues
  without OCR detection. Capability hardening remains in later steps.
- `legacy-ingest.mjs` intentionally retains the 639-line implementation until Step 2 modularizes it.

## Next action

Execute Step 2 only after preserving the Step 1 contract fixture as the compatibility oracle.
