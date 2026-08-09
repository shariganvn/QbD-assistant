import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { runFormulationSpike } from "../formulation-spike-run.mjs";
import { runFormulationSelection } from "../formulation-selection-run.mjs";

const verdictPath = new URL("../../../docs/reports/qbd-p221-formulation-selection/test-verdict.json", import.meta.url);

test("G-05 reports full-ingest determinism separately from downstream determinism", async () => {
  const ingestRoot = mkdtempSync(join(tmpdir(), "qbd-p221-g05-ingest-"));
  try {
    const spike = await runFormulationSpike({ outDir: join(ingestRoot, "evidence") });
    const ingestVerdict = spike.evidence["go-no-go.json"];
    assert.equal(ingestVerdict.full_ingest_deterministic, true);
    assert.equal(spike.evidence["two-run-ingest-hashes.json"].byte_identical, true);
  } finally {
    rmSync(ingestRoot, { recursive: true, force: true });
  }

  const firstRoot = mkdtempSync(join(tmpdir(), "qbd-p221-g05-downstream-a-"));
  const secondRoot = mkdtempSync(join(tmpdir(), "qbd-p221-g05-downstream-b-"));
  try {
    const first = runFormulationSelection({ outputRoot: firstRoot, runId: "g05-downstream" });
    const second = runFormulationSelection({ outputRoot: secondRoot, runId: "g05-downstream" });
    assert.deepEqual(first.publication_receipt.artifact_hashes, second.publication_receipt.artifact_hashes);
    assert.equal(
      readFileSync(join(firstRoot, "formula-evidence-diagnostic.json"), "utf8"),
      readFileSync(join(secondRoot, "formula-evidence-diagnostic.json"), "utf8"),
    );
    const verdict = JSON.parse(readFileSync(verdictPath, "utf8"));
    assert.equal(verdict.determinism.full_ingest.label, "full-ingest");
    assert.equal(verdict.determinism.full_ingest.status, "pass");
    assert.equal(verdict.determinism.downstream.label, "downstream-from-pinned-store");
    assert.equal(verdict.determinism.downstream.status, "pass");
    assert.notEqual(verdict.determinism.full_ingest.label, verdict.determinism.downstream.label);
  } finally {
    rmSync(firstRoot, { recursive: true, force: true });
    rmSync(secondRoot, { recursive: true, force: true });
  }
});
