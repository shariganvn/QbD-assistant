import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { buildDecisionPackages, SOURCE_STORE_SHA256 } from "./fixtures/decision-package-fixtures.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(testDir, "fixtures/decision-package");
const gatesPath = resolve(testDir, "../../../docs/plans/qbd-rationale-report-layer/gates.yaml");
const packageMembers = [
  "cohort.json", "evidence-log.json", "evidence-log.md", "fact-cards.json",
  "formula-decision.json", "formula-decision.md", "linear-attestation.json",
  "publication-receipt.json", "selection-evaluation.json",
];

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function gatePin(branch) {
  const key = `source_package_${branch}_sha256`;
  const match = readFileSync(gatesPath, "utf8").match(new RegExp(`^\\s+${key}: ([0-9a-f]{64})$`, "m"));
  assert.ok(match, `missing ${key} pin`);
  return match[1];
}

function members(root) {
  return readdirSync(root).sort();
}

test("decision-package fixtures are injected P4 CLI output with pinned source store", () => {
  const temp = mkdtempSync(join(tmpdir(), "rationale-decision-packages-"));
  try {
    const generated = buildDecisionPackages({ outputRoot: temp });
    assert.equal(generated.store_sha256, SOURCE_STORE_SHA256);
    for (const branch of ["selected", "inconclusive", "attested"]) {
      const actualRoot = join(temp, branch);
      const expectedRoot = join(fixtureRoot, branch);
      const expectedMembers = packageMembers.filter((name) => branch === "attested" || name !== "linear-attestation.json").sort();
      assert.deepEqual(members(actualRoot), expectedMembers);
      assert.deepEqual(members(expectedRoot), expectedMembers);
      for (const name of expectedMembers) {
        assert.deepEqual(readFileSync(join(actualRoot, name)), readFileSync(join(expectedRoot, name)), `${branch}/${name} drifted from injected P4 CLI output`);
      }
      assert.equal(sha256(readFileSync(join(expectedRoot, "publication-receipt.json"))), gatePin(branch));
    }
    const inconclusive = JSON.parse(readFileSync(join(temp, "inconclusive", "formula-decision.json"), "utf8"));
    const evaluation = JSON.parse(readFileSync(join(temp, "inconclusive", "selection-evaluation.json"), "utf8"));
    assert.equal(inconclusive.rubric_sha256, null);
    assert.equal(evaluation.rubric_sha256, null);
    assert.equal(sha256(readFileSync(join(temp, "selected", "publication-receipt.json"))), generated.receipt_sha256.selected);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
