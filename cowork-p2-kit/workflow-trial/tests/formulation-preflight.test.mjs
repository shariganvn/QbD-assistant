import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  checkFileHash,
  checkNodeVersion,
  findExecutable,
  parseNodeMajor,
  runFormulationPreflight,
} from "../formulation-preflight.mjs";

test("preflight helpers parse and enforce the Node major", () => {
  assert.equal(parseNodeMajor("22.22.2"), 22);
  assert.equal(parseNodeMajor("v21.9.0"), null);
  assert.equal(checkNodeVersion("22.1.0").ok, true);
  assert.equal(checkNodeVersion("20.19.0").code, "E_NODE_VERSION");
});

test("file hash helper checks a temporary fixture without touching canonical inputs", () => {
  const root = mkdtempSync(join(tmpdir(), "formulation-preflight-"));
  try {
    const filePath = join(root, "fixture.docx");
    writeFileSync(filePath, "frozen test bytes");
    assert.equal(checkFileHash({ filePath, expectedSha256: "f6885e095f48eed8521726dbfbf6615f456f679ba1c3e4c5a3664828ce6b5354", label: "test fixture" }).ok, true);
    assert.equal(checkFileHash({ filePath: join(root, "missing.docx"), expectedSha256: "a".repeat(64), label: "test fixture" }).code, "E_FORMULATION_FIXTURE_MISSING");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("preflight reports missing fixtures and missing bwrap with stable codes", () => {
  const root = mkdtempSync(join(tmpdir(), "formulation-preflight-missing-"));
  try {
    const result = runFormulationPreflight({ root, nodeVersion: "22.22.2", pathEnv: root, unzipPath: join(root, "unzip") });
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.map((error) => error.code), ["E_FORMULATION_FIXTURE_MISSING", "E_FORMULATION_FIXTURE_MISSING", "E_UNZIP_MISSING", "E_BWRAP_MISSING"]);
    assert.match(result.errors[0].message, /restore the frozen DOCX fixture/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("findExecutable only accepts executable files in the supplied PATH", () => {
  const root = mkdtempSync(join(tmpdir(), "formulation-preflight-path-"));
  try {
    const candidate = join(root, "bwrap");
    writeFileSync(candidate, "#!/bin/sh\n");
    assert.equal(findExecutable("bwrap", root), null);
    chmodSync(candidate, 0o755);
    assert.equal(findExecutable("bwrap", root), candidate);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
