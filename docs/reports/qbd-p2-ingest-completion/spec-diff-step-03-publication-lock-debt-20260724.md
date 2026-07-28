---
title: "Step 3 publication-lock security spec-diff"
date: 2026-07-28
review_type: post-closure security spec-diff
canonical_plan: docs/plans/qbd-p2-ingest-completion/plan.md
canonical_gate: G-05
decision: docs/decisions/D20260722-qbd-p2-ingest-toctou-tech-debt.md
evidence: artifacts/260728-1344/test-verdict.json
verdict: accept-security-debt
---

# Step 3 publication-lock security spec-diff

## Verdict

**ACCEPT SECURITY DEBT — bounded P2 behavior is verified; hostile-host compliance is not.**

The committed P2 scope strengthens input/artifact-root admission and cooperative publication cleanup.
Its fresh G-01…G-10 evidence records 64 passing assertions and zero failures. This is sufficient to
accept the bounded P2 closeout described by the plan patch; it is not sufficient to close the hostile
same-host TOCTOU debt accepted in D20260722. This report neither changes historical gate evidence nor
claims that the remaining security risk is fixed.

## ELI junior product owner

The lock is a small “occupied” sign beside `records.jsonl`. It stops two normal ingest runs from writing
the same store at once. Before removing its own sign, a run checks that the sign still has its own run ID.

The gap is the tiny moment between “I checked the sign” and “I removed the sign.” A hostile program on the
same machine, with permission to alter this directory, could swap in its own sign in that moment. The
ingest cleanup could then remove the hostile program's sign instead of its own. Normal ingest runs do not
do that: they see the occupied sign and return `E_PUBLICATION_LOCKED`.

So the product behaviour is still protected for normal concurrent ingest runs. What is not guaranteed is
protection against another local program deliberately tampering with lock files at exactly the right time.

## Reasoning layer and trust boundary

The verified protocol assumes writers follow the ingest lock contract. Under that assumption, a writer
uses exclusive creation, fails closed for live/malformed/indeterminate locks, and cleanup moves the
public lock to a run-specific private path before inspecting and deleting it. The tests cover replacement
of the public lock before cleanup and replacement of that public path after the private-path inspection;
they retain the competing public lock in both cases. They do not replace the private release path itself.

A hostile same-host actor is outside that protocol: it can mutate names in the publication directory at
arbitrary points. Node's pathname operations here do not establish a portable, OS/filesystem-scoped
identity binding between an object trusted during acquisition, stale reclaim/rollback, temp cleanup, or
release and the object later written, renamed, or unlinked. Renaming into a private path narrows the
cooperative race, but does not prove that an adversary cannot replace a release path between operations.
This is the unresolved publication-lock boundary in D20260722; LiteParse trusted-object binding is a
separate, also-open half of the same decision.

## Spec-diff matrix

| Step 3 contract | Current result | Disposition |
|---|---|---|
| A second protocol-conforming writer returns `E_PUBLICATION_LOCKED` without waiting or changing the first run's temp/store files. | Met. The synchronized two-process test records the first private temp and verifies the store, lock, and temp bytes remain unchanged after the second writer exits locked. Qualifying old/dead lock reclaim remains the contract's explicit exception. | Retained G-05 coverage. |
| Public-lock release preserves a competing cooperative writer's public lock. | Met for the injected public-path replacement cases: replacement before cleanup and replacement after private-path inspection retain the competing public lock; a private-lock read failure removes the run's private cleanup file. The private release path itself is not adversarially replaced. | Retain as cooperative behavior; D20260722 remains active. |
| Failed publication preserves the prior store byte-for-byte. | Strengthened. Recursive snapshots cover a nested preserved file; schema, round-trip, and pre-rename failures retain the prior store, while a post-rename read failure does not convert a completed publish into an error. | Fresh G-04 coverage. |
| Roots, symlinks, and extensions are rejected before publication/parsing side effects. | Strengthened. An inside-store artifact root is rejected without directory creation; a symlinked artifact root or symlinked missing ancestor fails before lock/temp creation; nested input symlinks and unsupported extensions are rejected before parsing. | Fresh G-06 coverage. |

## Evidence from this audit

| Check | Fresh result |
|---|---|
| Attested isolated P2 suite | 64 pass, 0 fail; verdict is accepting but exit-code-only, so assertion counts are sourced from the gate records below. |
| `publication-failure.test.mjs` (G-04) | 9 pass, 0 fail |
| `publication-concurrency.test.mjs` | 9 pass, 0 fail |
| `file-boundaries.test.mjs` (G-06) | 8 pass, 0 fail |
| `pipeline.test.mjs` | 12 pass, 0 fail; byte-identical child-CLI happy path |
| Source identity | The six P2 source/test hashes in the test-plan record match the isolated checkout and the committed P2 source. |

## Required follow-up

Before claiming hostile same-host lock safety, approve a dedicated security design that defines the
supported OS/filesystem, directory ownership/permission assumptions, and attacker model. It must use an
identity-bound release mechanism rather than check-then-unlink pathname operations, and include
executable replacement tests for public lock, private release/reclaim, and run-temp paths during creation,
reclaim/rollback, cleanup, and release. Before claiming the complete decision closed, add the equivalent
trusted-object binding for LiteParse execution.

## Scope boundary

This acceptance applies only where writers are protocol-conforming and the inputs, store, artifact root,
and configured executable have trusted ownership with non-shared-writable parent directories. In a
deployment that permits an untrusted local actor to alter those paths, the debt is a production-blocking
integrity/availability risk; the actor can tamper with the store directly, so a lock-only patch would not
be sufficient. Within the cooperative deployment model, the debt does not weaken the JSONL contract or
the verified G-04/G-05/G-06 evidence. D20260722 also retains the independent LiteParse check-to-use gap;
this report does not resolve or broaden that item.
