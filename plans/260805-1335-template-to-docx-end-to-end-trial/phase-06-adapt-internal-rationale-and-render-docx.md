---
phase: 6
title: "Adapt Internal Rationale and Render DOCX"
status: pending
priority: P1
effort: "6h"
dependencies: [5]
---

# Phase 6: Adapt Internal Rationale and Render DOCX

## Context Links

- [Phase 5](./phase-05-run-separate-rationale-authoring-and-publication.md)
- `cowork-p2-kit/render/README.md`
- `cowork-p2-kit/render/contract.mjs`
- `cowork-p2-kit/render/document-builder.mjs`
- `cowork-p2-kit/render/publication.mjs`

## Overview

Add one pure trial adapter from validated rationale package to the existing
structured draft contract, then render a deterministic DOCX. Preserve the mock's
`citable=false` status: no fact citation or evidence footnote is emitted.

## Requirements

- Functional: revalidate reasoning package/store, rationale packet/source package,
  rationale package, and claim bindings before draft construction.
- Functional: represent every approved non-fact rationale claim exactly once as
  plain internal-review blocks; include a clear `chờ_dữ_liệu` non-citable notice.
- Functional: require zero rationale `fact` claims before mapping; never upgrade
  classification, copy a mock quote/value, or invent an evidence link.
- Non-functional: adapter is pure; render writes one DOCX only to fresh temp root,
  under network isolation, with deterministic OOXML.

## Architecture

`buildInternalTrialDraft({ trialRoot, reasoningRoot, rationaleRoot, storeBytes })`
validates root containment/packages and returns a draft. Rendering uses a narrow
trial-compatible no-network wrapper because the existing isolated-spike wrapper
rejects drafts and nested roots outside its current layout. The draft/renderer
public contracts remain unchanged.

## File Inventory

| Action | Path | Rough size | Test impact |
|---|---|---:|---|
| Create | `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/workflow-trial/rationale-to-render-draft.mjs` | 140-220 lines | Pure validation/mapping seam |
| Modify | `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/workflow-trial/tests/workflow-trial.e2e.test.mjs` | +80-130 lines | Adapter tests, sandboxed draft and DOCX stage |
| Modify if required | `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/render/run-isolated-spike.mjs` | 20-50 lines | Admit an explicit controller-owned trial layout without changing defaults |
| Modify if required | `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/render/tests/isolated-network.test.mjs` | +30-60 lines | Preserve old root rejection and prove the narrow new admission path |

## Function and Interface Checklist

- [ ] `buildInternalTrialDraft` performs no writes and requires every input root
      to be a real descendant of the immutable controller-owned trial root.
- [ ] Existing package/packet/rationale validators run in correct order.
- [ ] `validateDraft` accepts the result with `citations=[]`.
- [ ] Normalized OOXML output is deterministic; raw DOCX hash is diagnostic.
- [ ] `publishBuffer` receives a fresh exact output root only.
- [ ] Existing isolated-render defaults and rejection tests remain unchanged;
      only the explicit trial admission path is new.

## Implementation Steps

1. Run GitNexus impact before editing any existing symbol. Prefer imports; if the
   existing isolation wrapper must change, keep it to root-admission compatibility
   and preserve its public/default behavior.
2. Write cross-stage tests for tampered packages, omitted/extra claims, any fact
   claim, forged citation/link, invalid block, root escape, and render failure.
3. Implement strict root/package/store validation and deterministic claim order.
4. Map decision-state/causal text to plain paragraphs and add internal/non-citable
   headings/`chờ_dữ_liệu`; reject facts needing forbidden citations.
5. Adapt or add the smallest trial-compatible isolated render entry point: bind
   repository read-only, exact trial root writable, and network disabled; fail
   if Bubblewrap is unavailable. Do not broaden the production render CLI.
6. Validate canonical draft JSON, reopen DOCX ZIP, and assert required parts plus
   expected internal text and absence of footnotes/sources.
7. Re-render identical input and require equal normalized OOXML manifests; record
   raw SHA-256 values for diagnosis without making equality a gate.

## Test Scenario Matrix

| Risk | Scenario | Expected |
|---|---|---|
| Critical | Adapter upgrades citable flag or emits footnote | Reject/no DOCX |
| Critical | Rationale/package/store mismatch | Revalidation failure |
| High | Claim omitted, duplicated, or reordered unexpectedly | Adapter binding error |
| High | Network isolation unavailable | Fail; no unisolated fallback |
| Medium | Render output already exists | Reject fresh-root precondition |

## Success Criteria

- [ ] Validated draft contains only internal non-citable content and all approved claims.
- [ ] One readable DOCX with deterministic normalized OOXML exists only under the run root.
- [ ] No production render output, report, or gate evidence changes.

## Risk Assessment and Rollback

The render contract naturally models public citations, not generalized packet
references. Keep non-fact claims plain and data explicitly waiting. The only
extra seam is one pure adapter plus the minimum sandbox compatibility needed by
the controller; do not expand the draft contract.

## Security Considerations

Run renderer with network namespace disabled and repository read-only. Allow
write access only to the exact active run root; fail if Bubblewrap is unusable.

## Next Steps

Phase 7 runs the complete chain twice and performs final review/closeout.
