import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const repoRoot = resolve(import.meta.dirname, "../../..");
const fixturePath = join(repoRoot, "cowork-p2-kit/render/tests/fixtures/fidelity/two-citation-draft.json");
const isolatedSpikeScript = join(repoRoot, "cowork-p2-kit/render/run-isolated-spike.mjs");

function runIsolatedSpike() {
  const outputRoot = join(tmpdir(), `isolated-output-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const reportRoot = join(tmpdir(), `isolated-report-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(outputRoot, { recursive: true });
  mkdirSync(reportRoot, { recursive: true });

  // Run the isolation wrapper
  const stdout = execFileSync(process.execPath, [
    isolatedSpikeScript,
    "--draft", fixturePath,
    "--output-root", outputRoot,
    "--report-root", reportRoot,
  ], { cwd: repoRoot, encoding: "utf8", timeout: 120_000 });

  // Parse the snapshot from stdout
  const snapshot = JSON.parse(stdout);

  // Write snapshot to GATE_SNAPSHOT_FILE if set (for run-gate.mjs to collect)
  const snapshotFile = process.env.GATE_SNAPSHOT_FILE;
  if (snapshotFile) {
    mkdirSync(join(snapshotFile, ".."), { recursive: true });
    writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2) + "\n");
  }

  return { snapshot, outputRoot, reportRoot };
}

let isolatedRun;
before(() => {
  isolatedRun = runIsolatedSpike();
});
after(() => {
  rmSync(isolatedRun.outputRoot, { recursive: true, force: true });
  rmSync(isolatedRun.reportRoot, { recursive: true, force: true });
});

test("G-P3-04: wrapper discovers bwrap and runs render-spike.mjs", () => {
  const { snapshot } = isolatedRun;

  // Verify bwrap is in the argv
  assert.ok(snapshot.argv[0].includes("bwrap"), "First argv element must be bwrap");
  assert.ok(snapshot.argv.includes("--unshare-net"), "argv must include --unshare-net");

  // Verify render-spike.mjs is invoked (not run-isolated-spike.mjs)
  const spikeIndex = snapshot.argv.indexOf("cowork-p2-kit/render/render-spike.mjs");
  assert.ok(spikeIndex >= 0, "argv must invoke render-spike.mjs");

  const draftIndex = snapshot.argv.indexOf("--draft");
  assert.equal(
    snapshot.argv[draftIndex + 1],
    "/work/cowork-p2-kit/render/tests/fixtures/fidelity/two-citation-draft.json",
    "The host draft path must be translated into the read-only /work mount",
  );

  // Verify it does NOT invoke run-isolated-spike.mjs (no recursion)
  const isolatedIndex = snapshot.argv.indexOf("run-isolated-spike.mjs");
  assert.equal(isolatedIndex, -1, "Must not invoke run-isolated-spike.mjs (no recursion)");
});

test("G-P3-04: wrapper uses read-only binds for repo and runtime", () => {
  const { snapshot } = isolatedRun;
  const argv = snapshot.argv;

  // Verify read-only binds exist
  const roBindCount = argv.filter((a) => a === "--ro-bind").length;
  assert.ok(roBindCount >= 5, `Must have at least 5 --ro-bind args, got ${roBindCount}`);

  // Verify /work is read-only bound
  const workIndex = argv.indexOf("/work");
  assert.ok(workIndex >= 0, "Must bind-mount /work");
  assert.equal(argv[workIndex - 2], "--ro-bind", "/work must be read-only bound");

  // Verify runtime paths are read-only bound
  for (const path of ["/usr", "/lib", "/lib64", "/bin", "/etc"]) {
    const pathIndex = argv.indexOf(path);
    assert.ok(pathIndex >= 0, `Must bind-mount ${path}`);
    assert.equal(argv[pathIndex - 1], "--ro-bind", `${path} must be read-only bound`);
  }
});

test("G-P3-04: wrapper uses writable binds only for output and report", () => {
  const { snapshot } = isolatedRun;
  const argv = snapshot.argv;

  // Count writable binds (--bind, not --ro-bind)
  const bindIndices = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--bind") bindIndices.push(i);
  }

  // Should have exactly 2 writable binds (output and report)
  assert.equal(bindIndices.length, 2, `Must have exactly 2 --bind args, got ${bindIndices.length}`);

  // Verify /out and /report are the writable targets
  const writableTargets = bindIndices.map((i) => argv[i + 2]);
  assert.ok(writableTargets.includes("/out"), "Must bind-mount /out writable");
  assert.ok(writableTargets.includes("/report"), "Must bind-mount /report writable");
});

test("G-P3-04: wrapper uses tmpfs, proc, and dev", () => {
  const { snapshot } = isolatedRun;
  const argv = snapshot.argv;

  assert.ok(argv.includes("--tmpfs"), "Must use --tmpfs");
  assert.ok(argv.includes("/tmp"), "Must mount tmpfs at /tmp");
  assert.ok(argv.includes("--proc"), "Must use --proc");
  assert.ok(argv.includes("--dev"), "Must use --dev");
});

test("G-P3-04: wrapper changes to /work directory", () => {
  const { snapshot } = isolatedRun;
  const argv = snapshot.argv;

  assert.ok(argv.includes("--chdir"), "Must use --chdir");
  const chdirIndex = argv.indexOf("--chdir");
  assert.equal(argv[chdirIndex + 1], "/work", "Must change to /work");
});

test("G-P3-04: snapshot contains required metadata", () => {
  const { snapshot } = isolatedRun;

  // Verify snapshot structure
  assert.ok(Array.isArray(snapshot.argv), "snapshot.argv must be an array");
  assert.ok(typeof snapshot.argv_hash === "string", "snapshot.argv_hash must be a string");
  assert.ok(typeof snapshot.stdout === "string", "snapshot.stdout must be a string");
  assert.ok(typeof snapshot.stderr === "string", "snapshot.stderr must be a string");
  assert.ok(typeof snapshot.exit_code === "number", "snapshot.exit_code must be a number");
  assert.ok(typeof snapshot.versions === "object", "snapshot.versions must be an object");
  assert.ok(typeof snapshot.timestamp === "string", "snapshot.timestamp must be a string");

  // Verify versions
  assert.ok(typeof snapshot.versions.node === "string", "versions.node must be a string");
  assert.ok(typeof snapshot.versions.npm === "string", "versions.npm must be a string");
  assert.ok(typeof snapshot.versions.bwrap === "string", "versions.bwrap must be a string");

  // Verify exit code is 0 (success)
  assert.equal(snapshot.exit_code, 0, "Exit code must be 0 for successful render");
});

test("G-P3-04: snapshot contains output hash", () => {
  const { snapshot } = isolatedRun;

  assert.ok(typeof snapshot.output_sha256 === "string", "snapshot.output_sha256 must be a string");
  assert.ok(snapshot.output_sha256.length === 64, "output_sha256 must be 64 hex chars (SHA-256)");
});

test("G-P3-04: no root plans directory is created", () => {
  const { outputRoot, reportRoot } = isolatedRun;

  // Check that no plans directory was created at the repo root
  const rootPlansPath = join(repoRoot, "plans");
  assert.ok(!existsSync(rootPlansPath), "No root plans/ directory should be created");

  // Also check output and report roots
  const outputPlansPath = join(outputRoot, "plans");
  const reportPlansPath = join(reportRoot, "plans");
  assert.ok(!existsSync(outputPlansPath), "No plans/ in output root");
  assert.ok(!existsSync(reportPlansPath), "No plans/ in report root");
});

test("G-P3-04: wrapper rejects a writable repository bind", (t) => {
  const reportRoot = join(tmpdir(), `isolated-report-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(reportRoot, { recursive: true });
  t.after(() => rmSync(reportRoot, { recursive: true, force: true }));

  const result = spawnSync(process.execPath, [
    isolatedSpikeScript,
    "--draft", fixturePath,
    "--output-root", join(repoRoot, "cowork-p2-kit"),
    "--report-root", reportRoot,
  ], { cwd: repoRoot, encoding: "utf8" });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--output-root must be a direct test-created child/);
});

test("G-P3-04: wrapper rejects a draft symlink that resolves outside /work", (t) => {
  const outputRoot = join(tmpdir(), `isolated-output-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const reportRoot = join(tmpdir(), `isolated-report-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(outputRoot, { recursive: true });
  mkdirSync(reportRoot, { recursive: true });
  const escapedDraft = join(repoRoot, "cowork-p2-kit/render/tests/fixtures/fidelity", `escaped-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  symlinkSync("/etc/hosts", escapedDraft);
  t.after(() => {
    rmSync(escapedDraft, { force: true });
    rmSync(outputRoot, { recursive: true, force: true });
    rmSync(reportRoot, { recursive: true, force: true });
  });

  const result = spawnSync(process.execPath, [
    isolatedSpikeScript,
    "--draft", escapedDraft,
    "--output-root", outputRoot,
    "--report-root", reportRoot,
  ], { cwd: repoRoot, encoding: "utf8" });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--draft must resolve to a file below the repository root/);
});
