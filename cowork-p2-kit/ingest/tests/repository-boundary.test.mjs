import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

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
    "node --test cowork-p2-kit/ingest/tests/repository-boundary.test.mjs " +
    "cowork-p2-kit/ingest/tests/record-contract.test.mjs " +
    "cowork-p2-kit/ingest/tests/pipeline.test.mjs && " +
    "node cowork-p2-kit/ingest/tests/run-gate.mjs G-04 cowork-p2-kit/ingest/tests/publication-failure.test.mjs && " +
    "node cowork-p2-kit/ingest/tests/run-gate.mjs G-05 cowork-p2-kit/ingest/tests/publication-concurrency.test.mjs && " +
    "node cowork-p2-kit/ingest/tests/run-gate.mjs G-06 cowork-p2-kit/ingest/tests/file-boundaries.test.mjs",
  );
  assert.equal(packageJson.scripts.render, "node cowork-p2-kit/render/render-docx.mjs");
  assert.equal(packageJson.dependencies.docx, "9.7.1");
});
