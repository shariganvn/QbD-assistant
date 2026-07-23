# Step 2 — Implement Fail-Closed Renderer

## Goal

Validate the complete structured draft before output mutation and keep Layer C a deterministic renderer.

## Preconditions

- G-P3-01 is `pass`.
- Run GitNexus impact for each existing renderer function to be changed and report its risk.

## Exact file map

- `cowork-p2-kit/render/{render-docx,contract,document-builder,publication}.mjs`
- `cowork-p2-kit/render/tests/{output-preservation,contract}.test.mjs`
- `cowork-p2-kit/render/tests/fixtures/output-preservation/`
- `package.json` only if the existing `render` script needs a compatibility-preserving CLI shim

## Work

1. Keep `render-docx.mjs` as the CLI entrypoint; extract `contract.mjs`, `document-builder.mjs`, and
   `publication.mjs`. Libraries return typed results and never call `process.exit`; the entrypoint
   alone prints one declared error code and exits nonzero.
2. Parse and validate the entire draft before creating the output root. Reject every contract error
   using the exact code table in `plan.md`; do not silently fall back to demo mode when an explicit
   input path is missing or unreadable.
3. Publish only with a unique temp file inside the injected output root, then atomic rename. On any
   validation or write failure, remove only that invocation's temp file and preserve the full seeded
   output-root hash map.
4. Make demo mode construct the same envelope from only public, `citable:true`, successful store
   records; it must supply evidence IDs and classification, generate no reasoning, and cite no
   uncitable record.
5. Tests inject the output root through one documented `--output-root <absolute-path>` CLI argument;
   no environment-variable alternative is accepted.

## Validation

- Run focused G-P3-01 and G-P3-02 tests. Do not run or claim the final `npm run verify:render` suite
  until G-P3-03 through G-P3-05 test files and the completed viewer checklist exist.
- Record input/output hashes and exact negative-result codes.

## Stop conditions

- Stop if any validation failure alters the seeded output.
- Stop if a renderer module starts doing Phase 4 reasoning or an LLM call.
