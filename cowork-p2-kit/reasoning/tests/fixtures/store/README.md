# Frozen reasoning store fixture

This is the Step 0, byte-for-byte snapshot for the Layer B reasoning tests. It contains the
17 admitted public/mock F-01, F-02, and F-03 records only; Step 2 owns synthetic inadmissible
records.

| Field | Value |
| --- | --- |
| Source ingest evidence | G-08 real ingest run (`run_id` `1c9cae2d-cad3-416d-adae-d5dc72016406`) |
| Source ingest date | 2026-07-22T12:19:45.314Z |
| Source path | `cowork-p2-kit/store/records.jsonl` |
| Record count | 17 |
| SHA-256 | `6a16599838b8335e58f4e4f985c78d089cdd55e1a9b11696d240414b2fc28c56` |

The source and `records.jsonl` snapshot were verified byte-identical on 2026-07-24. The SHA-256
is the Step 0 reproducibility pin in
[`gates.yaml`](../../../../../docs/plans/qbd-p4-reasoning-layer/gates.yaml), not an FD or human
approval attestation.
