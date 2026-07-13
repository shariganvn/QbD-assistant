---
phase: 3
title: "Render spike and layer (OfficeCLI)"
status: pending
priority: P1
effort: "1.5d"
dependencies: [1]
---

# Phase 3: Render spike and layer (OfficeCLI)

## Overview

Deterministic Layer C: render the structured draft + citations into `p2-draft.docx`. **Runs
the P1.2 fidelity spike FIRST** — round-trip of footnotes / hyperlinks / TOC / tables — because
that result gates the whole output-format lock. Reusable later as `qbd_core` `DocRenderPort`.

## Requirements

- Functional: fill a `.docx` from structured input with working footnotes, clickable
  hyperlinks, TOC, and tables; the **LLM never writes the final file** — this layer does.
- Non-functional: deterministic, idempotent; runnable from CLI in the kit workflow.

## Architecture

Candidate renderer = `iOfficeAI/OfficeCLI` (self-contained .NET binary, Apache-2.0). **Verified:
no `dotnet`/`mono` runtime is installed here** — the spike cannot run until the binary is
provisioned, so provisioning is a Step-0 pre-req, not an assumption. The named fallback if the
spike fails is a **docx-templating path (`docx-templates`/`python-docx`)** or Pandoc; the trigger
and its known limits are decided up front (Step 2), not improvised. Spike verifies fidelity
**and offline behaviour** before committing. Input = the structured P.2.2/P.2.3 draft + citation
list from Phase 4; output = `cowork-p2-kit/outputs/p2-draft.docx`. `render/` is scaffolded in
Phase 1; this phase owns all files under `render/**`. See `docs/system-architecture.md` §2, §8.

## Related Code Files

- Create: `cowork-p2-kit/render/render-docx.mjs` (or shell wrapper) — structured draft → docx
- Create: `cowork-p2-kit/render/README.md` — OfficeCLI setup, run steps, fidelity result
- Create (report): `plans/260713-1034-qbd-p2-cowork-mvp/reports/officecli-fidelity-spike.md`

## Implementation Steps

0. **Provision (pre-req):** verify or install the .NET runtime / OfficeCLI self-contained
   binary; **pin exact version + commit and record its checksum** in `render/README.md`. If
   provisioning can't be done, stop and escalate — do not silently skip the spike.
1. **Spike (do first, timeboxed to 0.5d):** build a minimal test doc exercising footnotes +
   hyperlinks + TOC + a table; run it through OfficeCLI **under an egress-blocked / network-
   monitored environment**; open the result and verify each element survives round-trip. Record
   pass/fail per element **and any outbound network connection** in the spike report.
2. **Gate decision (explicit rubric):** *must-pass* = footnotes + clickable hyperlinks + fully
   offline render (any outbound connection during render = automatic no-go, regardless of
   fidelity). *nice-to-have* = TOC + complex tables (a gap here is documented, not blocking). If
   must-pass holds → lock `.docx`-via-OfficeCLI; else switch to the named fallback (docx-templating
   / Pandoc) and document its citation-fidelity limits. Do NOT assume fidelity or offline behaviour.
3. Build the render layer: map the structured draft (headings, prose, tables, claim→citation)
   to OfficeCLI calls; emit `outputs/p2-draft.docx`.
4. Wire citations as numbered footnotes with clickable links (evidence adjacent to claim).
5. Keep the renderer input contract stable so Phase 4 can target it and `qbd_core` can reuse it.

## Success Criteria

- [ ] Toolchain provisioned; version/commit + checksum pinned in `render/README.md`.
- [ ] Spike report records per-element round-trip fidelity, the must-pass/nice-to-have verdict,
      **and offline confirmation** (no outbound connection during render) + go/no-go.
- [ ] Output format locked (OfficeCLI or the named fallback) — decision + rubric written down.
- [ ] Render layer produces `p2-draft.docx` from a structured sample with working footnotes/links/TOC.
- [ ] LLM produces structured content only; render is deterministic.

## Risk Assessment

- **P1.2 fidelity is unverified and gates format** — this is why the spike runs first. A late
  discovery of poor fidelity would invalidate the output design; the must-pass/nice-to-have
  rubric + named fallback + 0.5d timebox bound that risk.
- **Toolchain (verified gap):** no .NET runtime is installed here; OfficeCLI is a self-contained
  .NET binary, so the real work is **provisioning + verifying headless offline run** (Step 0),
  not "install a C# runtime." Surfaces before the spike so it can't silently block Phases 4–6.
- **Supply chain:** OfficeCLI is a young third-party binary that will render a confidential
  dossier under the §8 reuse contract; pin version/checksum and treat any render-time outbound
  connection as an exfiltration no-go.

> Red Team (260713): absorbed fixes for the missing toolchain/provisioning, undefined
> fallback/timebox/fidelity-rubric, and supply-chain egress verification. See `plan.md` → Red
> Team Review.
