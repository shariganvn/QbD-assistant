#!/usr/bin/env node
// Verifies an already-rendered .docx: (1) XSD structural validity via the `docx` skill's
// validate.py, (2) text-extraction sanity checks (scope-notice present once, every declared gap
// section's marker present, sign-off table present). Kept separate from render.mjs so it can be
// re-run standalone against any already-produced file.
//
// LibreOffice/soffice-based visual rendering is broken in this sandbox (confirmed sandbox-wide —
// even a trivial one-paragraph docx and a plain .txt file both fail to convert), so this script
// intentionally does not attempt a soffice --convert-to pdf round trip; it fails loudly if the
// validator script it depends on cannot be found rather than silently skipping the check.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";

import JSZip from "jszip";

class VerifyError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "VerifyError";
    this.code = code;
  }
}

const VALIDATE_PY_CANDIDATES = [
  process.env.DOCX_SKILL_VALIDATE_PY,
  "/root/.claude/skills/synced/docx/scripts/office/validate.py",
].filter(Boolean);

function findValidatePy() {
  const found = VALIDATE_PY_CANDIDATES.find((path) => existsSync(path));
  if (!found) {
    throw new VerifyError(
      "E_VALIDATOR_MISSING",
      `docx skill's validate.py not found (checked: ${VALIDATE_PY_CANDIDATES.join(", ")}). ` +
      "Set DOCX_SKILL_VALIDATE_PY to its path, or install the docx skill.",
    );
  }
  return found;
}

function runXsdValidation(docxPath) {
  const validatePy = findValidatePy();
  try {
    const output = execFileSync("python3", [validatePy, docxPath], { encoding: "utf8" });
    return { ok: true, output };
  } catch (error) {
    return { ok: false, output: `${error.stdout ?? ""}${error.stderr ?? ""}` || error.message };
  }
}

async function extractText(docxPath) {
  const buffer = readFileSync(docxPath);
  const zip = await JSZip.loadAsync(buffer);
  const documentXmlFile = zip.file("word/document.xml");
  if (!documentXmlFile) throw new VerifyError("E_NO_DOCUMENT_XML", `word/document.xml not found in ${docxPath}`);
  const xml = await documentXmlFile.async("string");
  const texts = [];
  const pattern = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let match;
  while ((match = pattern.exec(xml)) !== null) texts.push(match[1]);
  return texts.join("");
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

async function runSanityChecks(docxPath, draft) {
  const text = await extractText(docxPath);
  const failures = [];

  const noticeCount = countOccurrences(text, "Lưu ý phạm vi tài liệu");
  if (noticeCount !== 1) failures.push(`scope-notice title should appear exactly once, found ${noticeCount}`);

  const signoffCount = countOccurrences(text, "Ghi nhận soạn thảo và rà soát");
  if (signoffCount !== 1) failures.push(`sign-off section heading should appear exactly once, found ${signoffCount}`);

  if (draft) {
    const gapSections = draft.sections.filter((section) => section.status === "gap");
    for (const section of gapSections) {
      const count = countOccurrences(text, section.gapReason);
      if (count < 1) failures.push(`gap reason for section "${section.id}" not found in rendered text`);
    }
  }

  return failures;
}

function parseArguments(argv) {
  let docxPath;
  let draftPath;
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--draft") {
      draftPath = argv[++index];
    } else if (argument.startsWith("-")) {
      throw new VerifyError("E_ARGS", `unsupported option: ${argument}`);
    } else if (docxPath) {
      throw new VerifyError("E_ARGS", "only one .docx path is supported");
    } else {
      docxPath = argument;
    }
  }
  if (!docxPath) throw new VerifyError("E_ARGS", "usage: verify.mjs <output.docx> [--draft draft.json]");
  return { docxPath, draftPath };
}

async function main() {
  const { docxPath, draftPath } = parseArguments(process.argv.slice(2));
  const draft = draftPath ? JSON.parse(readFileSync(draftPath, "utf8")) : null;

  const xsd = runXsdValidation(docxPath);
  process.stdout.write(`XSD validation: ${xsd.ok ? "PASS" : "FAIL"}\n${xsd.output}\n`);

  const failures = await runSanityChecks(docxPath, draft);
  if (failures.length > 0) {
    process.stdout.write(`Text sanity checks: FAIL\n${failures.map((f) => `  - ${f}`).join("\n")}\n`);
  } else {
    process.stdout.write("Text sanity checks: PASS\n");
  }

  if (!xsd.ok || failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const code = error instanceof VerifyError ? error.code : "E_UNKNOWN";
  process.stderr.write(`${code}: ${error.message}\n`);
  process.exitCode = 1;
});
