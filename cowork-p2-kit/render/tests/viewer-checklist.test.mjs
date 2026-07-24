import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import { normalizeOoxml } from "../normalize-ooxml.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const checklistPath = join(repoRoot, "docs/reports/qbd-p3-render-layer/gates/G-P3-05-viewer.md");
const templatePath = join(repoRoot, "docs/reports/qbd-p3-render-layer/gates/G-P3-05-viewer.template.md");
const fixtureDraft = join(repoRoot, "cowork-p2-kit/render/tests/fixtures/fidelity/two-citation-draft.json");

const REQUIRED_FIELDS = [
  "Reviewer",
  "Review date",
  "Viewer product",
  "Viewer version",
  "Host baseline",
  "Fixture SHA-256",
  "Opened DOCX SHA-256",
  "Normalized manifest SHA-256",
  "Opened DOCX path",
];

const REQUIRED_OBSERVATIONS = [
  "positive_footnotes",
  "usp_link",
  "local_provenance",
  "toc",
  "table_layout",
];

const SHA256_RE = /^[0-9a-f]{64}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(value) {
  if (!ISO_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const reconstructed = new Date(Date.UTC(year, month - 1, day));
  return reconstructed.getUTCFullYear() === year
    && reconstructed.getUTCMonth() === month - 1
    && reconstructed.getUTCDate() === day;
}

function parseChecklist(content) {
  const fields = {};
  const observations = {};

  // Parse fields: look for **Key**: value or **Key**: _placeholder_
  const fieldRe = /\*\*([^*]+)\*\*:\s*(.+)/g;
  let match;
  while ((match = fieldRe.exec(content)) !== null) {
    const key = match[1].trim();
    const value = match[2].trim();
    if (Object.hasOwn(fields, key)) throw new Error(`duplicate checklist field: ${key}`);
    // Skip placeholder values
    fields[key] = value.startsWith("_") && value.endsWith("_") ? "" : value;
  }

  // Parse observations: look for - **key** blocks with Verdict and Observation
  const obsBlockRe = /- \*\*([a-z_]+)\*\*\s*\n\s+- Verdict:\s*(\S+)\s*\n\s+- Observation:\s*(.+)/g;
  while ((match = obsBlockRe.exec(content)) !== null) {
    const key = match[1].trim();
    const verdict = match[2].trim();
    const observation = match[3].trim();
    if (Object.hasOwn(observations, key)) throw new Error(`duplicate checklist observation: ${key}`);
    // Skip placeholder values
    observations[key] = {
      verdict: verdict.startsWith("_") && verdict.endsWith("_") ? "" : verdict,
      observation: observation.startsWith("_") && observation.endsWith("_") ? "" : observation,
    };
  }

  const unknownFields = Object.keys(fields).filter((key) => !REQUIRED_FIELDS.includes(key));
  if (unknownFields.length > 0) throw new Error(`unknown checklist field: ${unknownFields.join(", ")}`);

  return { fields, observations };
}

describe("G-P3-05 viewer checklist", () => {
  it("checklist file exists and is not the blank template", () => {
    assert.ok(existsSync(checklistPath), "G-P3-05-viewer.md must exist");
    const content = readFileSync(checklistPath, "utf8");
    const template = readFileSync(templatePath, "utf8");
    assert.notEqual(content, template, "checklist must differ from the blank template");
  });

  it("all required fields are present and non-blank", () => {
    const content = readFileSync(checklistPath, "utf8");
    const { fields } = parseChecklist(content);

    for (const field of REQUIRED_FIELDS) {
      assert.ok(field in fields, `missing required field: ${field}`);
      assert.ok(fields[field].length > 0, `blank value for field: ${field}`);
    }
  });

  it("reviewer is non-empty", () => {
    const content = readFileSync(checklistPath, "utf8");
    const { fields } = parseChecklist(content);
    assert.ok(fields.Reviewer && fields.Reviewer.length > 0, "reviewer must be non-empty");
  });

  it("review date is a valid YYYY-MM-DD calendar date", () => {
    const content = readFileSync(checklistPath, "utf8");
    const { fields } = parseChecklist(content);
    assert.ok(isValidCalendarDate(fields["Review date"]), "review date must be a valid YYYY-MM-DD calendar date");
  });

  it("viewer product is LibreOffice or Microsoft Word", () => {
    const content = readFileSync(checklistPath, "utf8");
    const { fields } = parseChecklist(content);
    assert.ok(
      ["LibreOffice", "Microsoft Word"].includes(fields["Viewer product"]),
      "viewer product must be LibreOffice or Microsoft Word"
    );
  });

  it("viewer version is non-empty", () => {
    const content = readFileSync(checklistPath, "utf8");
    const { fields } = parseChecklist(content);
    assert.ok(fields["Viewer version"] && fields["Viewer version"].length > 0, "viewer version must be non-empty");
  });

  it("host baseline is Windows host + WSL2 Ubuntu", () => {
    const content = readFileSync(checklistPath, "utf8");
    const { fields } = parseChecklist(content);
    assert.equal(fields["Host baseline"], "Windows host + WSL2 Ubuntu");
  });

  it("opened DOCX path is absolute", () => {
    const content = readFileSync(checklistPath, "utf8");
    const { fields } = parseChecklist(content);
    assert.ok(
      fields["Opened DOCX path"].startsWith("/") || /^[A-Z]:\\/i.test(fields["Opened DOCX path"]),
      "opened DOCX path must be absolute"
    );
  });

  it("SHA-256 hashes are lowercase 64-hex format", () => {
    const content = readFileSync(checklistPath, "utf8");
    const { fields } = parseChecklist(content);
    assert.ok(SHA256_RE.test(fields["Fixture SHA-256"]), "fixture SHA-256 must be lowercase 64-hex");
    assert.ok(SHA256_RE.test(fields["Opened DOCX SHA-256"]), "opened DOCX SHA-256 must be lowercase 64-hex");
    assert.ok(SHA256_RE.test(fields["Normalized manifest SHA-256"]), "normalized manifest SHA-256 must be lowercase 64-hex");
  });

  it("fixture SHA-256 matches the committed input fixture hash", () => {
    const content = readFileSync(checklistPath, "utf8");
    const { fields } = parseChecklist(content);
    const expectedHash = createHash("sha256").update(readFileSync(fixtureDraft)).digest("hex");
    assert.equal(fields["Fixture SHA-256"], expectedHash, "fixture hash must match the committed draft");
  });

  it("normalized manifest SHA-256 matches a fresh normalization", () => {
    const content = readFileSync(checklistPath, "utf8");
    const { fields } = parseChecklist(content);
    // The checklist should reference a rendered DOCX; we verify the manifest hash format only
    // because the actual DOCX is created during the manual procedure and may not be in the repo
    assert.ok(SHA256_RE.test(fields["Normalized manifest SHA-256"]), "manifest hash must be valid SHA-256");
  });

  it("all five required observations are present with PASS verdicts", () => {
    const content = readFileSync(checklistPath, "utf8");
    const { observations } = parseChecklist(content);

    for (const key of REQUIRED_OBSERVATIONS) {
      assert.ok(key in observations, `missing required observation: ${key}`);
      assert.equal(observations[key].verdict, "PASS", `observation ${key} must have verdict PASS`);
      assert.ok(observations[key].observation.length > 0, `observation ${key} must have non-empty text`);
    }
  });

  it("no unknown observation keys are present", () => {
    const content = readFileSync(checklistPath, "utf8");
    const { observations } = parseChecklist(content);
    const unknownKeys = Object.keys(observations).filter((k) => !REQUIRED_OBSERVATIONS.includes(k));
    assert.deepEqual(unknownKeys, [], "no unknown observation keys allowed");
  });

  it("rejects duplicate and unknown checklist keys", () => {
    assert.throws(() => parseChecklist("**Reviewer**: one\n**Reviewer**: two"), /duplicate checklist field: Reviewer/);
    assert.throws(() => parseChecklist("**Unexpected field**: value"), /unknown checklist field: Unexpected field/);
    assert.throws(
      () => parseChecklist("- **toc**\n  - Verdict: PASS\n  - Observation: one\n- **toc**\n  - Verdict: PASS\n  - Observation: two"),
      /duplicate checklist observation: toc/,
    );
  });

  it("rejects uppercase hash characters", () => {
    const content = readFileSync(checklistPath, "utf8");
    const { fields } = parseChecklist(content);
    // SHA-256 hashes must be lowercase only
    assert.ok(fields["Fixture SHA-256"] === fields["Fixture SHA-256"].toLowerCase(), "fixture hash must be lowercase");
    assert.ok(fields["Normalized manifest SHA-256"] === fields["Normalized manifest SHA-256"].toLowerCase(), "manifest hash must be lowercase");
  });

  it("rejects invalid calendar dates like 2026-02-30", () => {
    assert.equal(isValidCalendarDate("2026-02-30"), false);
    assert.equal(isValidCalendarDate("2026-02-28"), true);
  });

  it("normalized manifest SHA-256 matches a fresh normalization of a rendered DOCX", () => {
    const content = readFileSync(checklistPath, "utf8");
    const { fields } = parseChecklist(content);
    const checklistManifestHash = fields["Normalized manifest SHA-256"];
    assert.ok(SHA256_RE.test(checklistManifestHash), "manifest hash must be valid lowercase SHA-256");

    // Render the committed fixture fresh and normalize it
    const outRoot = mkdtempSync(join(tmpdir(), "viewer-verify-"));
    const reportRoot = mkdtempSync(join(tmpdir(), "viewer-report-"));
    try {
      const result = spawnSync(process.execPath, [
        join(repoRoot, "cowork-p2-kit/render/render-spike.mjs"),
        "--draft", fixtureDraft,
        "--output-root", outRoot,
        "--report-root", reportRoot,
      ], { cwd: repoRoot, encoding: "utf8", timeout: 60000 });
      assert.equal(result.status, 0, `render failed: ${result.stderr}`);

      const docxPath = join(outRoot, "p2-draft.docx");
      const norm = normalizeOoxml(docxPath);
      assert.equal(norm.manifest_sha256, checklistManifestHash,
        "fresh render normalized manifest hash must match checklist");
    } finally {
      rmSync(outRoot, { recursive: true, force: true });
      rmSync(reportRoot, { recursive: true, force: true });
    }
  });
});
