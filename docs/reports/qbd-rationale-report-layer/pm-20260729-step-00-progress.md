# Step 0 progress — frozen rationale source packages

Date: 2026-07-29  
Plan: [`qbd-rationale-report-layer`](../../plans/qbd-rationale-report-layer/plan.md)

| Item | Result |
| --- | --- |
| Step 0 | completed — source-fixture readiness closed |
| Source packages | Generated selected, inconclusive, and attested decision packages under `cowork-p2-kit/rationale/tests/fixtures/decision-package/` |
| Selected receipt pin | `e2675b861a53db0293df1d9fafa7f9030fdb6d84a60cdc5060f3f17425737559` |
| Inconclusive receipt pin | `723a7186a76ab03216bacc23f416e280899bd59eed1b030ab6cf0a456272ea50` |
| Attested receipt pin | `e85a819d6548bb3a47493ae314d443ca67f97d33bba52b53e4bdf56ad2ffdf6e` |
| Source-store pin | `6a16599838b8335e58f4e4f985c78d089cdd55e1a9b11696d240414b2fc28c56` |
| Independent test | `decision-package-fixtures.test.mjs`: 1/1 passing |
| Upstream regression | Isolated `npm run verify:reasoning`: 122/122 passing |
| Review | 10.0/10; no findings |
| P4 boundary | `cowork-p2-kit/reasoning/` and `docs/reports/qbd-p4-reasoning-layer/` untouched |
| Next pickup | Step 1 — [Seal the packet contract](../../plans/qbd-rationale-report-layer/step-01-packet-contract-and-sealer.md) |

The three committed fixtures are generated through the injected retained P4 CLI factory and are pinned by their `publication-receipt.json` SHA-256 values in `gates.yaml`.
