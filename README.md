# QbD Assistant — PO pilot handoff

## Read this first

This repository is a controlled prototype for turning a **bounded package of formulation documents**
into traceable internal decision-support artifacts. It is designed to help a Product Owner (PO) and
Formulation Development (FD) team test whether supplied evidence can be ingested, compared under an
FD-defined rubric, and explained with every claim traceable to its source.

It is **not** a system that approves a formulation, drafts P.2.2/P.2.3, releases a dossier, or
publishes external-facing content.

The bounded pilot uses the approved **public/synthetic mock-document fixture handoff**. Engineering can
run the isolated pilot and document the gaps found. Do not send confidential, internal, or
production-controlled records for this pilot.

## What the project does today

```text
PO/FD supplies a named document package
        ↓
Layer A: ingest documents; preserve provenance and classification
        ↓
Layer B: compare only the supplied evidence under a hash-bound rubric
        ↓
Rationale: create a source-bound explanation for internal review
        ↓
FD/PO reviews the evidence, gaps, and inconclusive outcomes
```

| Capability | Current state | Important boundary |
|---|---|---|
| Ingest DOCX/PDF within a manifest | Ready for the bounded pilot | Inputs outside the declared package are rejected. |
| Preserve source provenance | Ready | Evidence remains tied to its source file/page/quote. |
| Compare formulations | Prototype ready | A real selection needs an FD-approved, hash-pinned rubric; otherwise the correct outcome is `inconclusive`. |
| Detect some missing/conflicting evidence | Partially ready | The system can stop, but it does not yet manage the full human gap-resolution lifecycle. |
| Generate rationale | Ready for internal review | Output is permanently `internal_only` in the current implementation. |
| Approve a formula, draft P.2.2/P.2.3, or display externally | Not available | These require separately approved work and controls. |

The completed reasoning and rationale suites validate the test-fixture/internal scope. They are not
proof of an FD-approved scientific decision or a production deployment.

## Current state

### Current pilot intake

The bounded pilot accepts only the approved **public/synthetic-only** fixture handoff. The complete,
PO-friendly intake boundary is in [the mock-package preparation guide](docs/reports/qbd-p4-reasoning-layer/po-junior-mock-package-preparation-guide-20260729.md).

At minimum, it needs:

1. A pilot brief that names the question, candidate formulations, FD reviewer, and prohibited conclusions.
2. A product profile and three clearly identified trial reports.
3. A document list with exact filenames, version/date, candidate/strength, and citation status.
4. An FD draft rubric, explicitly marking any unresolved rule as `CHƯA CHỐT` rather than inventing a value.
5. UAT expected results for: comparable candidates, non-comparable candidates, and missing/conflicting evidence.
6. A linear-formulation confirmation only if different strengths are expected to share a cohort.

### Frozen fixture handoff (tracked in Git)

The two approved public/synthetic DOCX fixtures below are now tracked in Git so a clean clone is
runnable without a private restore step. They are the only DOCX exceptions to the broad input ignore
rule. Do not regenerate, replace, or add production/internal documents to these paths.

| Fixture | Git path | SHA-256 |
|---|---|---|
| Official placeholder template | `cowork-p2-kit/inputs/reference/official-placeholder-template-v3-040826.docx` | `c492532054d9ba04d2dbd5c3d03706c423534cce5329d2657b2588760e0087e0` |
| Filled public mock document | `cowork-p2-kit/inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx` | `01fe95607f4733e2b47a4c46f8dad5817d6014cc40f69a08631977c9d890cd8f` |

After cloning, the PO or junior agent can verify and run the bounded formulation trial with:

```bash
npm ci
npm run preflight:formulation
npm run test:formulation
```

The preflight is read-only and fails closed on a missing or changed fixture. It also checks Node 22,
`/usr/bin/unzip`, and `bwrap`; see [`cowork-p2-kit/README.md`](cowork-p2-kit/README.md) for the
WSL2 runtime boundary. These fixtures remain public/synthetic, `citable:false`, review-only, and
cannot authorize an FD decision, production use, dossier drafting, or external display.

PO owns scope, file list, UAT cases, and coordination. FD owns the scientific comparison rules and
evidence interpretation. Engineering packages the manifest, runs the isolated pilot, and reports
reproducible failures; it must not choose thresholds, change classifications, or declare a winner.

### Canonical technical state

| Workstream | State | Meaning |
|---|---|---|
| P2 ingest/publication | Closed for the cooperative-writer test scope | See the canonical [gate definition](docs/plans/qbd-p2-ingest-completion/gates.yaml) and retained [evidence](docs/reports/qbd-p2-ingest-completion/). |
| Same-host TOCTOU debt (`D20260722`) | Open | Cooperative locking is covered; hostile same-host filesystem races are **not** solved. |
| P4 reasoning core | Completed for fixture/internal scope | It evaluates supplied packages deterministically; it does not draft dossier prose. |
| Rationale/report layer | Completed for fixture/internal scope | Its published reference package is test-only and internal-only; see the retained [gate evidence](docs/reports/qbd-rationale-report-layer/gates/). |
| PO pilot readiness | GO with boundaries | Safe to receive public/synthetic mocks and run an isolated trial; not ready for production or direct PO installation. |

Implementation routing has no alternate machine-readable route: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
is authoritative and currently records no active plan. Reports and reviews are evidence, not pickup
authority. The cooperative-writer boundary remains limited; hostile same-host TOCTOU is not resolved.
See [D20260722](docs/decisions/D20260722-qbd-p2-ingest-toctou-tech-debt.md) for that boundary.

## Next steps for the bounded pilot

1. Validate the approved fixture handoff and confirm every file is public/synthetic.
2. Convert the PO document list to the technical manifest without broadening permissions or citation status.
3. Run the pilot in an isolated workspace; retain provenance and do not overwrite historical evidence.
4. Compare the outputs with the three UAT cases. A missing, conflicting, or unapproved input must lead to an explicit stop or `inconclusive`, never an invented winner.
5. Record defects and approval/data gaps before proposing any change to code or contracts.
6. Only after the pilot, agree a separate plan for the specific gap to solve.

The readiness review defines this as **GO for controlled mock intake and isolated testing**, and
**NO-GO for production use, formulation approval, external display, or P.2.2/P.2.3 drafting**:
[mock-docs readiness review](docs/reports/qbd-p4-reasoning-layer/mock-docs-readiness-review-20260729.md).

## Most valuable future development

The next product work should close the human-in-the-loop loop, rather than extend the current test
fixtures:

1. **Data-gap lifecycle:** an explicit report that says which candidate/measure is missing, what is
   needed, who owns it, and whether a later supplied file closes the gap.
2. **FD approval record:** a hash-bound rubric/decision approval with reviewer, date, scope, supersede,
   and revoke behavior.
3. **Rerun lineage:** link a new store/package hash to the original gap without rewriting history.
4. **Complete inconclusive rationale:** explain every allowed missing/conflict outcome, not only the
   currently sealed subset.
5. **Clean-machine UAT:** prove installation and operation on a PO environment before considering
   direct use.
6. **External display and P.2.2/P.2.3:** only after a separate decision authorizes them and their
   approval/citation controls are specified and tested.
7. **Security hardening:** if a deployment admits hostile same-host actors, design identity-bound file
   operations and trusted-object binding for LiteParse before claiming that boundary is secure.

The detailed gap register and test seeds are in
[missing-data and human-approval gap review](docs/reports/qbd-p4-reasoning-layer/missing-data-human-approval-gap-review-20260729.md).

## Key documents for an agent

| Need | Read |
|---|---|
| Prepare the mock package | [PO/junior preparation guide](docs/reports/qbd-p4-reasoning-layer/po-junior-mock-package-preparation-guide-20260729.md) |
| Decide whether pilot intake is allowed | [Mock readiness review](docs/reports/qbd-p4-reasoning-layer/mock-docs-readiness-review-20260729.md) |
| Understand PO/FD/Engineering responsibilities | [Preparation guide — roles](docs/reports/qbd-p4-reasoning-layer/po-junior-mock-package-preparation-guide-20260729.md#8-ai-lam-gi) |
| Understand current P2 security boundary | [D20260722](docs/decisions/D20260722-qbd-p2-ingest-toctou-tech-debt.md) |
| Understand why approval and data-gap work is next | [Gap review](docs/reports/qbd-p4-reasoning-layer/missing-data-human-approval-gap-review-20260729.md) |
| Inspect implementation routing | [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) → follow an active `plan.md` only when one is linked |

## Non-negotiable rules for a PO-facing agent

- Treat the supplied package as the entire corpus; do not search for extra documents or web evidence.
- Never turn a test fixture, draft rubric, or internal rationale into an FD approval.
- Keep different strengths separate unless FD supplies the required linear-formulation confirmation.
- Do not claim external display, dossier drafting, production readiness, or hostile same-host TOCTOU protection.
- Escalate scientific thresholds, cohort exceptions, approval, and ambiguous evidence to PO/FD rather than guessing.
