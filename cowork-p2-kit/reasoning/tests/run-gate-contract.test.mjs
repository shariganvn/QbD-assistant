import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const runner = resolve(repoRoot, "cowork-p2-kit/reasoning/tests/run-gate.mjs");
const child = "cowork-p2-kit/reasoning/tests/fixtures/contract/tap-child.test.mjs";

test("G-P4-01 runner accepts multiple test paths, forces TAP, parses its epilogue, and writes P4 evidence with store SHA", () => {
  const evidenceRoot = mkdtempSync(join(tmpdir(), "reasoning-gate-evidence-"));
  try {
    const result = spawnSync(process.execPath, [runner, "G-P4-01", child, child], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, REASONING_GATE_EVIDENCE_DIR: evidenceRoot },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^TAP version 13/m);
    const evidencePath = join(evidenceRoot, "G-P4-01.json");
    assert.ok(existsSync(evidencePath));
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    assert.equal(evidence.gate_id, "G-P4-01");
    assert.equal(evidence.status, "pass");
    assert.equal(evidence.command.at(-2), child);
    assert.equal(evidence.command.at(-1), child);
    assert.ok(evidence.command.includes("--test-reporter=tap"));
    assert.equal(evidence.assertions_summary.failed, 0);
    assert.equal(evidence.store_records_sha256, "6a16599838b8335e58f4e4f985c78d089cdd55e1a9b11696d240414b2fc28c56");
  } finally { rmSync(evidenceRoot, { recursive: true, force: true }); }
});

test("G-P4-01 runner rejects a non-P4 gate ID", () => {
  const result = spawnSync(process.execPath, [runner, "G-P3-01", child], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /G-P4-0\[1-5\]/);
});
