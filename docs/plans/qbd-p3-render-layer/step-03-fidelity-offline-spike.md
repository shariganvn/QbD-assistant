# Step 3 — Run Fidelity and Offline Spike

## Goal

Prove DOCX semantics and offline behavior with the actual renderer, not construction-only success.

## Preconditions

- G-P3-02 is `pass`.
- Discover `bwrap` in the current environment. Its absence is a blocking failure, not a manual exception.

## Exact file map

- `cowork-p2-kit/render/{render-spike,run-isolated-spike,document-builder}.mjs`
- `cowork-p2-kit/render/tests/{ooxml-fidelity,isolated-network}.test.mjs`
- `cowork-p2-kit/render/tests/fixtures/fidelity/two-citation-draft.json`
- `package.json`, `docs/reports/qbd-p3-render-layer/gates/`

## Work

1. Add `npm run render:spike` for an unisolated, argument-driven diagnostic render only. Add
   `run-isolated-spike.mjs` as the sole isolation owner; it calls `bwrap` with an argument array, not
   a shell string. `render-spike.mjs` must not invoke bwrap itself.
2. The isolation wrapper receives test-created absolute output and report roots. It read-only binds
   the repository at `/work` and `/usr`, `/lib`, `/lib64`, `/bin`, `/etc`; it bind-mounts only those
   two roots writable at `/out` and `/report`, uses `--tmpfs /tmp --proc /proc --dev /dev`, changes to
   `/work`, and invokes `node` on the committed spike script with `--output-root /out --report-root /report`.
3. Inspect the generated package at the exact OOXML parts named in G-P3-03. The hyperlink assertion
   reads `word/_rels/footnotes.xml.rels`; it verifies `TargetMode="External"` and the exact allowed URL.
4. The isolated-network test invokes the wrapper once, captures its literal argv/stdout/stderr and
   version output, and writes the output SHA-256 plus those records through the gate runner.

## Validation

- Run focused G-P3-01 through G-P3-04 tests; G-P3-04 succeeds only through the wrapper, never by a
  direct `bwrap --unshare-net -- npm …` command.
- Confirm no root `plans/` directory is created.

## Stop conditions

- If footnotes, approved hyperlinks, or isolated execution fails, stop Phase 3 and request a separately approved fallback-renderer plan.
