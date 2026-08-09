#!/usr/bin/env node

import { resolve } from "node:path";

import { compileTemplateFieldMap } from "../template-probe/template-field-map.mjs";
import { extractTemplateCellReceipt } from "../template-probe/template-record-extractor.mjs";

const repoRoot = resolve(import.meta.dirname, "../..");
const templatePath = resolve(repoRoot, "cowork-p2-kit/inputs/reference/official-placeholder-template-v3-040826.docx");
const filledPath = resolve(repoRoot, "cowork-p2-kit/inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx");
const COMPLETE_FIELD_COUNT = 146;

function fail(code, message) {
  const error = new Error(`[${code}] ${message}`);
  error.code = code;
  throw error;
}

export async function buildFormulationTemplateBinding() {
  const fieldMap = await compileTemplateFieldMap(templatePath);
  const receipt = await extractTemplateCellReceipt(fieldMap, filledPath, {
    ownerFieldMap: fieldMap,
    templateSourcePath: templatePath,
  });
  if (fieldMap.occurrence_count !== COMPLETE_FIELD_COUNT || receipt.occurrence_count !== COMPLETE_FIELD_COUNT) {
    fail("E_FORMULATION_TEMPLATE_INCOMPLETE", `expected ${COMPLETE_FIELD_COUNT} template fields, received ${fieldMap.occurrence_count}/${receipt.occurrence_count}`);
  }
  const missingRequired = receipt.entries
    .filter((entry) => entry.metadata.required && entry.raw_value.length === 0)
    .map((entry) => entry.canonical_field_id);
  if (missingRequired.length > 0) {
    fail("E_FORMULATION_TEMPLATE_INCOMPLETE", `required filled-template values are blank: ${missingRequired.join(", ")}`);
  }
  return { fieldMap, receipt };
}

if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  try {
    const binding = await buildFormulationTemplateBinding();
    process.stdout.write(JSON.stringify(binding));
  } catch (error) {
    process.stderr.write(`${error?.code ?? "E_FORMULATION_TEMPLATE"}: ${error.message}\n`);
    process.exitCode = 1;
  }
}
