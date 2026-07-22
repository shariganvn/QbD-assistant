import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { GATE_MAP } from "./verify-ingest.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const ingestDir = resolve(testDir, "..");
const repoRoot = resolve(testDir, "../../..");
const runtimeModules = readdirSync(ingestDir)
  .filter((name) => name.endsWith(".mjs"))
  .map((name) => relative(repoRoot, resolve(ingestDir, name)).replaceAll("\\", "/"))
  .sort();

function runGit(args) {
  return spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
}

test("all ingest runtime modules are tracked and not ignored", () => {
  assert.deepEqual(runtimeModules, [
    "cowork-p2-kit/ingest/admission.mjs",
    "cowork-p2-kit/ingest/cli.mjs",
    "cowork-p2-kit/ingest/config.mjs",
    "cowork-p2-kit/ingest/errors.mjs",
    "cowork-p2-kit/ingest/liteparse-adapter.mjs",
    "cowork-p2-kit/ingest/pipeline.mjs",
    "cowork-p2-kit/ingest/publication-support.mjs",
    "cowork-p2-kit/ingest/publication.mjs",
    "cowork-p2-kit/ingest/records.mjs",
    "cowork-p2-kit/ingest/schema-validation.mjs",
    "cowork-p2-kit/ingest/table-reconstruction.mjs",
  ]);

  for (const modulePath of runtimeModules) {
    const tracked = runGit(["ls-files", "--error-unmatch", "--", modulePath]);
    assert.equal(tracked.status, 0, `${modulePath} is not in the repository index`);

    const ignored = runGit(["check-ignore", "--quiet", "--", modulePath]);
    assert.equal(ignored.status, 1, `${modulePath} is unexpectedly ignored`);
  }
});

test("package scripts resolve to the tracked CLI and focused verification", () => {
  const packageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));

  assert.equal(packageJson.scripts.ingest, "node cowork-p2-kit/ingest/cli.mjs");
  assert.equal(
    packageJson.scripts["verify:ingest"],
    "node cowork-p2-kit/ingest/tests/verify-ingest.mjs",
  );
  assert.equal(packageJson.scripts.render, "node cowork-p2-kit/render/render-docx.mjs");
  assert.equal(packageJson.dependencies.docx, "9.7.1");
});

test("all Step 4 test, fixture, harness, and evidence files are tracked", () => {
  const requiredPaths = [
    // Step 4 test files
    "cowork-p2-kit/ingest/tests/admission-negative.test.mjs",
    "cowork-p2-kit/ingest/tests/capability-discovery.test.mjs",
    "cowork-p2-kit/ingest/tests/determinism.integration.test.mjs",
    "cowork-p2-kit/ingest/tests/complete-ingest-verification.test.mjs",
    "cowork-p2-kit/ingest/tests/run-gate.mjs",
    "cowork-p2-kit/ingest/tests/verify-ingest.mjs",
    "cowork-p2-kit/ingest/tests/verify-ingest-core.mjs",
    "cowork-p2-kit/ingest/tests/gate-evidence-validator.mjs",
    "cowork-p2-kit/ingest/tests/gate-evidence.contract.test.mjs",
    "cowork-p2-kit/ingest/tests/gate-runner-utils.mjs",
    "cowork-p2-kit/ingest/tests/gate-runner-utils.contract.test.mjs",
    "cowork-p2-kit/ingest/tests/verify-ingest-core.contract.test.mjs",
    // Admission fixtures
    "cowork-p2-kit/ingest/tests/fixtures/admission/inputs/classification-manifest.json",
    "cowork-p2-kit/ingest/tests/fixtures/admission/records.schema.json",
    "cowork-p2-kit/ingest/tests/fixtures/admission/inputs/product-profile.docx",
    "cowork-p2-kit/ingest/tests/fixtures/admission/inputs/trials/formulation-trial-01.docx",
    "cowork-p2-kit/ingest/tests/fixtures/admission/inputs/trials/formulation-trial-02.docx",
    "cowork-p2-kit/ingest/tests/fixtures/admission/inputs/trials/formulation-trial-03.docx",
    // Gate evidence
    "docs/reports/qbd-p2-ingest-completion/gates/G-01.json",
    "docs/reports/qbd-p2-ingest-completion/gates/G-02.json",
    "docs/reports/qbd-p2-ingest-completion/gates/G-03.json",
    "docs/reports/qbd-p2-ingest-completion/gates/G-04.json",
    "docs/reports/qbd-p2-ingest-completion/gates/G-05.json",
    "docs/reports/qbd-p2-ingest-completion/gates/G-06.json",
    "docs/reports/qbd-p2-ingest-completion/gates/G-07.json",
    "docs/reports/qbd-p2-ingest-completion/gates/G-08.json",
    "docs/reports/qbd-p2-ingest-completion/gates/G-09.json",
    "docs/reports/qbd-p2-ingest-completion/gates/G-10.json",
    "docs/reports/qbd-p2-ingest-completion/gates/suite.json",
    "docs/reports/qbd-p2-ingest-completion/step-04-g08-contract-design-20260722.md",
    "docs/reports/qbd-p2-ingest-completion/step-04-completion-20260722.md",
  ];

  for (const filePath of requiredPaths) {
    const tracked = runGit(["ls-files", "--error-unmatch", "--", filePath]);
    assert.equal(tracked.status, 0, `Step 4 required file not tracked: ${filePath}`);
  }
});

test("verify suite exports the exact literal ten-gate mapping", () => {
  const expectedMap = [
    ["G-01", "cowork-p2-kit/ingest/tests/repository-boundary.test.mjs"],
    ["G-02", "cowork-p2-kit/ingest/tests/record-contract.test.mjs"],
    ["G-03", "cowork-p2-kit/ingest/tests/pipeline.test.mjs"],
    ["G-04", "cowork-p2-kit/ingest/tests/publication-failure.test.mjs"],
    ["G-05", "cowork-p2-kit/ingest/tests/publication-concurrency.test.mjs"],
    ["G-06", "cowork-p2-kit/ingest/tests/file-boundaries.test.mjs"],
    ["G-07", "cowork-p2-kit/ingest/tests/admission-negative.test.mjs"],
    ["G-08", "cowork-p2-kit/ingest/tests/capability-discovery.test.mjs"],
    ["G-09", "cowork-p2-kit/ingest/tests/determinism.integration.test.mjs"],
    ["G-10", "cowork-p2-kit/ingest/tests/complete-ingest-verification.test.mjs"],
  ];
  assert.deepEqual(GATE_MAP, expectedMap);
});
