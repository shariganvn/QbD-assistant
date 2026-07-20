---
phase: 3
title: "Render spike and layer (Node docx; OfficeCLI fallback)"
status: in-progress
priority: P1
effort: "1d"
dependencies: [1]
---

# Phase 3: Render spike and layer (Node docx; OfficeCLI fallback)

## Overview

Deterministic Layer C: render the structured draft + citations into `p2-draft.docx` using a
**Node `docx` library in the kit's existing `.mjs` runtime**. **Runs the P1.2 fidelity spike
FIRST** — round-trip of footnotes / hyperlinks / TOC / tables — because that result gates the
whole output-format lock. The self-contained **.NET OfficeCLI binary is the named fallback**,
provisioned only if the Node spike fails a must-pass element. Reusable later as `qbd_core`
`DocRenderPort` via shell/CLI invocation.

## Requirements

- Functional: fill a `.docx` from structured input with working footnotes, clickable
  hyperlinks, TOC, and tables; the **LLM never writes the final file** — this layer does.
- Non-functional: deterministic, idempotent; runs **fully in-process and offline** (no extra
  runtime, no network); runnable from CLI in the kit workflow.

## Architecture

Primary renderer = the **`docx` npm library** (pure-JS OOXML writer, MIT) — same Node runtime as
ingest, so no second toolchain and no third-party binary on the dossier path; offline by
construction. **Verified: no `dotnet`/`mono` runtime is installed here**, which is exactly why
the Node-first path is primary: it needs no provisioning, whereas the fallback would. The named
fallback if the Node spike fails on a must-pass element = the self-contained **.NET OfficeCLI**
binary (`iOfficeAI/OfficeCLI`, Apache-2.0) — provisioned + pinned + checksummed only then — or
Pandoc. The spike verifies fidelity **and offline behaviour** before committing. Input = the
structured P.2.2/P.2.3 draft + citation list from Phase 4; output =
`cowork-p2-kit/outputs/p2-draft.docx`. `render/` is scaffolded in Phase 1; this phase owns all
files under `render/**`. See `docs/system-architecture.md` §2, §8.

## Related Code Files

- Create: `cowork-p2-kit/render/render-docx.mjs` — structured draft → docx via the `docx` npm lib
- Create: `cowork-p2-kit/render/README.md` — renderer choice, run steps, fidelity result, and the
  fallback OfficeCLI provisioning note (only if taken)
- Create (report): `plans/260713-1034-qbd-p2-cowork-mvp/reports/render-fidelity-spike.md`

## Implementation Steps

0. **Setup (pre-req):** add the `docx` npm dependency to the kit; **pin the exact version + record
   the lockfile integrity hash** in `render/README.md`. No .NET is needed for the primary path.
   (Fallback branch only — if the spike fails a must-pass element: provision the .NET runtime /
   OfficeCLI self-contained binary, pin exact version + commit, record its checksum instead. If
   the fallback also can't be provisioned, stop and escalate — do not silently skip the spike.)
1. **Spike (do first, timeboxed to 0.5d):** build a minimal test doc exercising footnotes +
   hyperlinks + TOC + a table with the `docx` lib; run it **under an egress-blocked / network-
   monitored environment**; open the result and verify each element survives round-trip. Record
   pass/fail per element **and any outbound network connection** in the spike report.
2. **Gate decision (explicit rubric):** *must-pass* = footnotes + clickable hyperlinks + fully
   offline render (any outbound connection during render = automatic no-go, regardless of
   fidelity). *nice-to-have* = TOC + complex tables (a gap here is documented, not blocking). If
   must-pass holds → lock `.docx`-via-`docx`-npm; else switch to the named fallback (.NET
   OfficeCLI, then Pandoc), provision it (Step 0 fallback branch), and document its citation-
   fidelity limits. Do NOT assume fidelity or offline behaviour.
3. Build the render layer: map the structured draft (headings, prose, tables, claim→citation)
   to `docx` lib calls; emit `outputs/p2-draft.docx`.
4. Wire citations as numbered footnotes; render a clickable `ExternalHyperlink` only when the
   citation carries an approved public URL, otherwise plain provenance text (evidence adjacent to
   claim) — see the remediation patch.
5. Keep the renderer input contract stable so Phase 4 can target it and `qbd_core` can reuse it
   by shell/CLI invocation.

## Success Criteria

- [ ] Primary renderer (`docx` npm) added; version + lockfile integrity pinned in `render/README.md`
      (or, if the fallback is taken, OfficeCLI version/commit + checksum recorded instead).
- [ ] Spike report records per-element round-trip fidelity, the must-pass/nice-to-have verdict,
      **and offline confirmation** (no outbound connection during render) + go/no-go.
- [ ] Output format locked (Node `docx`, or the named .NET/Pandoc fallback) — decision + rubric written down.
- [ ] Render layer produces `p2-draft.docx` from a structured sample with working footnotes/links/TOC.
- [ ] LLM produces structured content only; render is deterministic.

## Risk Assessment

- **P1.2 fidelity is unverified and gates format** — this is why the spike runs first. A late
  discovery of poor fidelity would invalidate the output design; the must-pass/nice-to-have
  rubric + named fallback + 0.5d timebox bound that risk.
- **Renderer runtime (verified gap):** no .NET/mono runtime is installed here. Node-first keeps
  render in the kit's existing runtime, so the primary path needs **no provisioning**; the .NET
  OfficeCLI fallback's provisioning + headless-offline verification cost is incurred **only if**
  the Node spike fails a must-pass element.
- **Supply chain:** the `docx` npm lib is pure-JS and offline by construction — still pin its
  version + lockfile integrity. If the OfficeCLI fallback is taken, it is a young third-party
  binary rendering a confidential dossier under the §8 reuse contract; pin version/checksum and
  treat any render-time outbound connection as an exfiltration no-go.

> Red Team (260713): absorbed fixes for the missing toolchain/provisioning, undefined
> fallback/timebox/fidelity-rubric, and supply-chain egress verification. See `plan.md` → Red
> Team Review.

<!-- Updated: Validation Session 1 - renderer inverted to Node-first (`docx` npm, same runtime); .NET OfficeCLI demoted to named fallback, provisioned only if the Node spike fails. Findings #5/#6 (offline render, no 3rd-party binary egress) now satisfied by staying in-runtime. -->

## Code Review Remediation Patch — 2026-07-16

**Why re-opened:** the current spike marks every element PASS merely because construction did not
throw. Its test document reuses footnote ID `0`, which conflicts with the DOCX continuation
separator, and the production citation contract has no link field or `ExternalHyperlink` emission.
The report claims an offline pass without a network-isolated/monitored run.

### Patch scope

1. **Pin supply chain:** change the `docx` dependency to exact `9.7.1`; retain the lockfile
   integrity value in `render/README.md`. Phase 3 alone owns this `package.json` dependency edit.
2. **Make the citation contract renderable:** require citation IDs to start at `1`; add an
   **optional** evidence-link field to the structured citation shape, populated **only with approved
   public URLs**. Emit the link as an `ExternalHyperlink` inside the numbered footnote **only when a
   public URL is present**; render local-only provenance as **plain text** (source + location),
   never a `file://`/relative/absolute path link — those would not resolve on the reviewer's machine.
   Reject any `file://`/absolute-path link target. Reject an inline citation that refers to no
   defined citation, and reject a cited record with `citable:false`.
3. **Repair and inspect footnotes:** generate Word footnotes only with positive IDs; add a test
   that unzips the output and asserts one unique positive footnote ID per reference, matching
   `w:footnoteReference` elements, and an external hyperlink relationship for **every citation that
   carries a public URL** (URL-only citations link; local-only ones are plain text). Do not treat
   `Packer.toBuffer()` success as fidelity.
4. **Re-run the fidelity gate:** run the renderer/spike in an isolated network namespace (use
   `bwrap --unshare-net` where available; otherwise fail closed and document the unavailable
   runner), record the command/result, inspect OOXML, then open in LibreOffice/Word for a visual
   footnote/link/TOC/table check. Only then choose Node or the named fallback.
5. **Reduce the demo to a minimal smoke test:** remove the hard-coded decision matrix and
   formula-selection prose from the demo builder (that reasoning is Phase 4's LLM output, not Layer
   C). The no-input demo renders **only** blocks provably cited from `store/records.jsonl` (each
   claim behind a real citable record) plus explicit `chờ dữ liệu` for anything unsupported. Layer C
   stays a pure renderer — no fabricated numbers.

### Required validation

- A structured fixture with two citations renders numbered footnotes `1` and `2` — the citation
  carrying a public URL renders a clickable `ExternalHyperlink`, the local-only citation renders
  plain provenance text (no link) — plus a TOC field and a table; OOXML and viewer checks agree.
- An unknown citation ID, a `citable:false` citation, and a `file://`/absolute-path link target each
  fail before creating/replacing `p2-draft.docx`. (A citation with no link is valid = plain text.)
- Identical structured input yields identical output content/OOXML after normalizing only the
  library's documented ZIP metadata; retain the hash/normalization command in the report.
- The report may say **PASS** only with captured isolated-network, OOXML, and viewer evidence;
  otherwise the Node renderer remains unselected and the fallback decision is escalated.

<!-- Updated: Validation Session 3 - evidence links are URL-only (ExternalHyperlink only for approved public URLs; local evidence = plain text; file://absolute-path targets rejected). Footnote test asserts a hyperlink relationship only for URL-bearing citations. Demo reduced to a minimal store-cited smoke test; hard-coded decision matrix + formula-selection prose removed (Phase 4's job). bwrap --unshare-net verified available for the offline render gate. -->
