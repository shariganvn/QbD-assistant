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
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import JSZip from "jszip";

// The heading comes from the renderer rather than being spelled again here: two copies of the same
// string in the two files that have to agree about it is the drift this whole document guards against.
import { SIGNOFF_HEADING } from "../render/builder.mjs";

class VerifyError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "VerifyError";
    this.code = code;
  }
}

// The docx skill has been installed at more than one layout, and a synced copy sits under a
// per-install directory whose name is a pair of identifiers. Search the known roots rather than
// pinning one path, and keep the environment override first so a machine that puts it somewhere else
// can still say where.
const VALIDATE_PY_SUFFIX = "docx/scripts/office/validate.py";
const VALIDATE_PY_ROOTS = ["/mnt/skills/public", "/root/.claude/skills/synced"];

function syncedCandidates() {
  const found = [];
  for (const root of VALIDATE_PY_ROOTS) {
    found.push(join(root, VALIDATE_PY_SUFFIX));
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (entry.isDirectory()) found.push(join(root, entry.name, VALIDATE_PY_SUFFIX));
    }
  }
  return found;
}

function findValidatePy() {
  const candidates = [process.env.DOCX_SKILL_VALIDATE_PY, ...syncedCandidates()].filter(Boolean);
  const found = candidates.find((path) => existsSync(path));
  if (!found) {
    throw new VerifyError(
      "E_VALIDATOR_MISSING",
      `docx skill's validate.py not found (checked: ${candidates.join(", ")}). ` +
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

// Heading levels in document order. Word derives its navigation pane and any generated table of
// contents from these, so a document whose levels jump — 1 straight to 3 — shows a flat or broken
// tree to the reviewer who uses it to navigate, no matter how correct the numbering text looks.
async function extractHeadingLevels(docxPath) {
  const buffer = readFileSync(docxPath);
  const zip = await JSZip.loadAsync(buffer);
  const documentXmlFile = zip.file("word/document.xml");
  if (!documentXmlFile) throw new VerifyError("E_NO_DOCUMENT_XML", `word/document.xml not found in ${docxPath}`);
  const xml = await documentXmlFile.async("string");
  const levels = [];
  // Each paragraph carries at most one style reference; a heading's is Heading1..Heading6.
  const paragraphPattern = /<w:p\b[\s\S]*?<\/w:p>/g;
  let paragraph;
  while ((paragraph = paragraphPattern.exec(xml)) !== null) {
    const style = /<w:pStyle\s+w:val="Heading(\d)"\s*\/>/.exec(paragraph[0]);
    if (style) levels.push(Number(style[1]));
  }
  return levels;
}

function headingTreeFailures(levels) {
  const failures = [];
  if (levels.length === 0) return ["no heading paragraph found — the document has no navigable structure"];
  let previous = 0;
  levels.forEach((level, index) => {
    if (level > previous + 1) {
      failures.push(`heading ${index + 1} jumps from level ${previous} to level ${level}; a level may only deepen one step at a time`);
    }
    previous = level;
  });
  return failures;
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

async function runSanityChecks(docxPath, draft) {
  const text = await extractText(docxPath);
  const failures = [...headingTreeFailures(await extractHeadingLevels(docxPath))];

  const noticeCount = countOccurrences(text, "Lưu ý phạm vi tài liệu");
  if (noticeCount !== 1) failures.push(`scope-notice title should appear exactly once, found ${noticeCount}`);

  const signoffCount = countOccurrences(text, SIGNOFF_HEADING);
  if (signoffCount !== 1) failures.push(`sign-off section heading should appear exactly once, found ${signoffCount}`);

  // Provenance is not a signature. The tool that assembled the draft is named once, in the scope
  // notice; the sign-off table below it carries a "Chữ ký" column and belongs to people. The check is
  // by print position, not by inspecting the string: a field holding a person's name must be kept off
  // the signature lines for exactly the same reason one holding a tool's name must.
  if (draft?.meta?.assembledBy) {
    const assembledCount = countOccurrences(text, draft.meta.assembledBy);
    if (assembledCount !== 1) {
      failures.push(`meta.assembledBy should be printed exactly once, as provenance, found ${assembledCount}`);
    } else if (signoffCount === 1 && text.indexOf(draft.meta.assembledBy) > text.indexOf(SIGNOFF_HEADING)) {
      failures.push("meta.assembledBy is printed after the sign-off heading; provenance belongs in the scope notice, not on a signature line");
    }
  }

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
