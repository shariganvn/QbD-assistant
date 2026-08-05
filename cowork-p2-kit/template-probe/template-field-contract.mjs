import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

export const FIELD_MAP_SCHEMA_VERSION = "template-field-map/v1";
export const FIELD_METADATA_SCHEMA_VERSION = "template-field-metadata/v1";
export const OCCURRENCE_ID_PATTERN = /^occ-[a-f0-9]{64}$/;

export class TemplateFieldContractError extends Error {
  constructor(code, message) {
    super(`[${code}] ${message}`);
    this.name = "TemplateFieldContractError";
    this.code = code;
  }
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sortCanonical(value) {
  if (Array.isArray(value)) return value.map(sortCanonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortCanonical(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return `${JSON.stringify(sortCanonical(value), null, 2)}\n`;
}

export function writeCanonicalJsonAtomic(value, outputPath, code = "E_ARTIFACT_WRITE") {
  const resolvedOutput = resolve(outputPath);
  const outputDirectory = dirname(resolvedOutput);
  const temporaryOutput = join(outputDirectory, `.${basename(resolvedOutput)}.${randomUUID()}.tmp`);
  try {
    mkdirSync(outputDirectory, { recursive: true });
    writeFileSync(temporaryOutput, canonicalJson(value), { flag: "wx" });
    renameSync(temporaryOutput, resolvedOutput);
  } catch (error) {
    try { rmSync(temporaryOutput, { force: true }); } catch { /* preserve the original write error */ }
    fail(code, `cannot atomically write ${resolvedOutput}: ${error.message}`);
  }
}

function fail(code, message) {
  throw new TemplateFieldContractError(code, message);
}

function requireCondition(condition, code, message) {
  if (!condition) fail(code, message);
}

function schemaTypeMatches(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  return typeof value === type;
}

export function validateJsonSchema(value, schema, path = "value") {
  const errors = [];
  const types = schema.type === undefined ? [] : (Array.isArray(schema.type) ? schema.type : [schema.type]);
  if (types.length && !types.some((type) => schemaTypeMatches(value, type))) return [`${path} must be ${types.join(" or ")}`];
  if (schema.const !== undefined && value !== schema.const) errors.push(`${path} must equal ${schema.const}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path} must be one of ${schema.enum.join(", ")}`);
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path} is too short`);
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) errors.push(`${path} does not match ${schema.pattern}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path} has too few items`);
    if (schema.items) value.forEach((item, index) => errors.push(...validateJsonSchema(item, schema.items, `${path}[${index}]`)));
  }
  if (schema.oneOf && !schema.oneOf.some((candidate) => validateJsonSchema(value, candidate, path).length === 0)) {
    errors.push(`${path} does not match any oneOf schema`);
  }
  if (schemaTypeMatches(value, "object")) {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) errors.push(`${path} missing required field ${key}`);
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(value)) if (!allowed.has(key)) errors.push(`${path}.${key} is not allowed`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) errors.push(...validateJsonSchema(value[key], child, `${path}.${key}`));
    }
  }
  return errors;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail("E_CONTRACT_READ", `cannot read JSON contract ${path}: ${error.message}`);
  }
}

export function loadTemplateContracts(options = {}) {
  return {
    manifest: options.manifest ?? readJson(options.manifestPath ?? new URL("./intake/template-freeze-manifest.v1.json", import.meta.url)),
    grammar: options.grammar ?? readJson(options.grammarPath ?? new URL("./intake/field-grammar.v1.json", import.meta.url)),
    metadata: options.metadata ?? readJson(options.metadataPath ?? new URL("./intake/field-metadata.v1.json", import.meta.url)),
  };
}

export function assertGrammar(grammar) {
  requireCondition(grammar?.schema_version === "template-field-grammar/v1", "E_GRAMMAR_VERSION", "unsupported field grammar version");
  requireCondition(/^[a-f0-9]{64}$/.test(grammar.template_sha256), "E_GRAMMAR_HASH", "grammar template_sha256 is invalid");
  requireCondition(grammar.visible_token?.multiplicity === "exactly-once", "E_GRAMMAR_MULTIPLICITY", "only exactly-once grammar is supported");
  const pattern = new RegExp(grammar.visible_token?.semantic_id_pattern ?? "$");
  const declared = grammar.declared_anchor_ids;
  requireCondition(Array.isArray(declared) && declared.length > 0, "E_GRAMMAR_ANCHORS", "grammar must declare anchors");
  const ids = new Set();
  for (const id of declared) {
    requireCondition(typeof id === "string" && pattern.test(id), "E_GRAMMAR_TOKEN", `invalid declared anchor ${id}`);
    requireCondition(!ids.has(id), "E_GRAMMAR_DUPLICATE", `duplicate declared anchor ${id}`);
    ids.add(id);
  }
  for (const [source, canonical] of Object.entries(grammar.canonical_id_aliases ?? {})) {
    requireCondition(ids.has(source), "E_GRAMMAR_ALIAS", `alias source is not declared: ${source}`);
    requireCondition(typeof canonical === "string" && pattern.test(canonical), "E_GRAMMAR_ALIAS", `invalid canonical alias ${canonical}`);
  }
  for (const source of Object.keys(grammar.owner_policy?.paragraph_exceptions ?? {})) {
    requireCondition(ids.has(source), "E_GRAMMAR_OWNER", `paragraph exception is not declared: ${source}`);
  }
  return grammar;
}

function metadataEntryShape(entry, index) {
  requireCondition(entry && typeof entry === "object" && !Array.isArray(entry), "E_METADATA_ENTRY", `metadata entry ${index} is not an object`);
  for (const key of ["source_token", "canonical_field_id", "type", "scope", "required"]) {
    requireCondition(Object.hasOwn(entry, key), "E_METADATA_ENTRY", `metadata entry ${index} is missing ${key}`);
  }
  requireCondition(typeof entry.source_token === "string", "E_METADATA_ENTRY", `metadata entry ${index} source_token is not a string`);
  requireCondition(typeof entry.canonical_field_id === "string", "E_METADATA_ENTRY", `metadata entry ${index} canonical_field_id is not a string`);
  requireCondition(entry.type === "raw_text", "E_METADATA_TYPE", `metadata entry ${entry.source_token} must use raw_text`);
  requireCondition(entry.unit === null || typeof entry.unit === "string", "E_METADATA_UNIT", `metadata entry ${entry.source_token} unit must be string or null`);
  requireCondition(typeof entry.scope === "string" && entry.scope.length > 0, "E_METADATA_SCOPE", `metadata entry ${entry.source_token} scope is empty`);
  requireCondition(typeof entry.required === "boolean", "E_METADATA_REQUIRED", `metadata entry ${entry.source_token} required must be boolean`);
}

export function assertMetadataCatalog(metadata, grammar = null, manifest = null) {
  requireCondition(metadata?.schema_version === FIELD_METADATA_SCHEMA_VERSION, "E_METADATA_VERSION", "unsupported field metadata version");
  requireCondition(/^[a-f0-9]{64}$/.test(metadata.template_sha256), "E_METADATA_HASH", "metadata template_sha256 is invalid");
  if (manifest) requireCondition(metadata.template_sha256 === manifest.template.sha256, "E_METADATA_HASH", "metadata is bound to another template");
  const entries = metadata.entries;
  requireCondition(Array.isArray(entries), "E_METADATA_ENTRIES", "metadata entries must be an array");
  const seen = new Set();
  for (const [index, entry] of entries.entries()) {
    metadataEntryShape(entry, index);
    if (seen.has(entry.source_token)) fail("E_METADATA_DUPLICATE", `duplicate metadata source_token ${entry.source_token}`);
    seen.add(entry.source_token);
  }
  if (grammar) {
    const declared = new Set(grammar.declared_anchor_ids);
    const missing = [...declared].filter((id) => !seen.has(id));
    const surplus = [...seen].filter((id) => !declared.has(id));
    if (missing.length) fail("E_METADATA_MISSING", `metadata missing anchors: ${missing.join(", ")}`);
    if (surplus.length) fail("E_METADATA_SURPLUS", `metadata contains undeclared anchors: ${surplus.join(", ")}`);
    const aliases = grammar.canonical_id_aliases ?? {};
    for (const entry of entries) {
      const expectedCanonical = aliases[entry.source_token] ?? entry.source_token;
      if (entry.canonical_field_id !== expectedCanonical) {
        fail("E_METADATA_ALIAS", `metadata canonical ID for ${entry.source_token} must be ${expectedCanonical}`);
      }
    }
  }
  return metadata;
}

export function ownerKey(owner) {
  if (owner?.kind === "cell") {
    return [
      "cell",
      `table=${owner.table}`,
      `row=${owner.row}`,
      `physical_cell=${owner.physical_cell}`,
      `logical_column_start=${owner.logical_column_start}`,
      `logical_column_end=${owner.logical_column_end}`,
      `grid_span=${owner.grid_span}`,
      `vertical_state=${owner.vertical_merge.state}`,
      `vertical_group=${owner.vertical_merge.group_id ?? ""}`,
    ].join("|");
  }
  if (owner?.kind === "paragraph") return `paragraph|paragraph=${owner.paragraph}`;
  fail("E_OWNER", "owner kind is unsupported");
}

export function deriveOccurrenceId(templateSha256, rawSourceToken, owner) {
  requireCondition(/^[a-f0-9]{64}$/.test(templateSha256), "E_OCCURRENCE_INPUT", "occurrence template hash is invalid");
  requireCondition(/^<[^<>\r\n]+>$/.test(rawSourceToken), "E_OCCURRENCE_INPUT", "raw source token is invalid");
  return `occ-${sha256(`${templateSha256}\n${rawSourceToken}\n${ownerKey(owner)}`)}`;
}

function assertOwner(owner, path) {
  requireCondition(owner && typeof owner === "object", "E_MAP_OWNER", `${path} owner is missing`);
  if (owner.kind === "cell") {
    for (const key of ["table", "row", "physical_cell", "logical_column_start", "logical_column_end", "grid_span"]) {
      requireCondition(Number.isInteger(owner[key]) && owner[key] > 0, "E_MAP_OWNER", `${path}.${key} is invalid`);
    }
    requireCondition(owner.logical_column_end >= owner.logical_column_start, "E_MAP_OWNER", `${path} logical column span is invalid`);
    requireCondition(owner.grid_span === owner.logical_column_end - owner.logical_column_start + 1, "E_MAP_OWNER", `${path} grid span does not reconcile`);
    requireCondition(["none", "restart"].includes(owner.vertical_merge?.state), "E_MAP_OWNER", `${path} vertical merge state is not an owner state`);
    requireCondition(owner.vertical_merge.state === "none" ? owner.vertical_merge.group_id === null : typeof owner.vertical_merge.group_id === "string", "E_MAP_OWNER", `${path} vertical merge group is invalid`);
    return;
  }
  if (owner.kind === "paragraph") {
    requireCondition(Number.isInteger(owner.paragraph) && owner.paragraph > 0, "E_MAP_OWNER", `${path}.paragraph is invalid`);
    return;
  }
  fail("E_MAP_OWNER", `${path} owner kind is unsupported`);
}

export function assertFieldMap(fieldMap, metadata = null) {
  requireCondition(fieldMap?.schema_version === FIELD_MAP_SCHEMA_VERSION, "E_MAP_VERSION", "unsupported field-map version");
  for (const key of ["template_sha256", "metadata_catalog_sha256", "field_map_sha256"]) {
    requireCondition(/^[a-f0-9]{64}$/.test(fieldMap[key]), "E_MAP_HASH", `${key} is invalid`);
  }
  requireCondition(typeof fieldMap.template_version === "string" && fieldMap.template_version.length > 0, "E_MAP_VERSION", "template_version is required");
  requireCondition(fieldMap.metadata_catalog_version === FIELD_METADATA_SCHEMA_VERSION, "E_MAP_VERSION", "metadata catalog version is unsupported");
  requireCondition(fieldMap.grammar_schema_version === "template-field-grammar/v1", "E_MAP_VERSION", "grammar schema version is unsupported");
  requireCondition(Number.isInteger(fieldMap.occurrence_count) && fieldMap.occurrence_count >= 0, "E_MAP_COUNT", "occurrence_count is invalid");
  requireCondition(Array.isArray(fieldMap.entries) && fieldMap.entries.length === fieldMap.occurrence_count, "E_MAP_COUNT", "occurrence_count does not match entries");
  const occurrenceIds = new Set();
  const ownerKeys = new Set();
  for (const [index, entry] of fieldMap.entries.entries()) {
    requireCondition(/^<[^<>\r\n]+>$/.test(entry.raw_source_token), "E_MAP_TOKEN", `entry ${index} raw_source_token is invalid`);
    requireCondition(typeof entry.canonical_field_id === "string" && entry.canonical_field_id.length > 0, "E_MAP_TOKEN", `entry ${index} canonical_field_id is invalid`);
    requireCondition(OCCURRENCE_ID_PATTERN.test(entry.occurrence_id), "E_MAP_OCCURRENCE", `entry ${index} occurrence_id is invalid`);
    requireCondition(entry.template_sha256 === fieldMap.template_sha256, "E_MAP_HASH", `entry ${index} template hash differs from map`);
    requireCondition(entry.template_version === fieldMap.template_version, "E_MAP_VERSION", `entry ${index} template version differs from map`);
    assertOwner(entry.owner, `entry ${index}`);
    requireCondition(entry.metadata?.type === "raw_text", "E_MAP_METADATA", `entry ${index} type is not raw_text`);
    requireCondition(entry.metadata.unit === null || typeof entry.metadata.unit === "string", "E_MAP_METADATA", `entry ${index} unit is invalid`);
    requireCondition(typeof entry.metadata.scope === "string" && entry.metadata.scope.length > 0, "E_MAP_METADATA", `entry ${index} scope is invalid`);
    requireCondition(typeof entry.metadata.required === "boolean", "E_MAP_METADATA", `entry ${index} required is invalid`);
    requireCondition(!occurrenceIds.has(entry.occurrence_id), "E_MAP_OCCURRENCE", `duplicate occurrence_id ${entry.occurrence_id}`);
    occurrenceIds.add(entry.occurrence_id);
    const key = ownerKey(entry.owner);
    requireCondition(!ownerKeys.has(`${key}|${entry.raw_source_token}`), "E_MAP_OCCURRENCE", `duplicate owner/token ${key}`);
    ownerKeys.add(`${key}|${entry.raw_source_token}`);
    if (index > 0) requireCondition(fieldMap.entries[index - 1].occurrence_id.localeCompare(entry.occurrence_id) < 0, "E_MAP_ORDER", "entries must be sorted by occurrence_id");
    requireCondition(entry.occurrence_id === deriveOccurrenceId(fieldMap.template_sha256, entry.raw_source_token, entry.owner), "E_MAP_OCCURRENCE", `entry ${index} occurrence_id does not bind to owner/token`);
  }
  const unsigned = { ...fieldMap, field_map_sha256: null };
  requireCondition(fieldMap.field_map_sha256 === sha256(canonicalJson(unsigned)), "E_MAP_HASH", "field_map_sha256 does not match canonical bytes");
  if (metadata) {
    assertMetadataCatalog(metadata);
    requireCondition(metadata.template_version === fieldMap.template_version, "E_MAP_METADATA_AUTHORITY", "metadata template version differs from field map");
    requireCondition(metadata.template_sha256 === fieldMap.template_sha256, "E_MAP_METADATA_AUTHORITY", "metadata template hash differs from field map");
    requireCondition(sha256(canonicalJson(metadata)) === fieldMap.metadata_catalog_sha256, "E_MAP_METADATA_AUTHORITY", "field map metadata hash differs from the supplied catalog");
    const metadataBySourceToken = new Map(metadata.entries.map((entry) => [entry.source_token, entry]));
    for (const [index, entry] of fieldMap.entries.entries()) {
      const sourceToken = entry.raw_source_token.slice(1, -1);
      const metadataEntry = metadataBySourceToken.get(sourceToken);
      requireCondition(metadataEntry, "E_MAP_METADATA_AUTHORITY", `metadata catalog is missing ${sourceToken}`);
      requireCondition(entry.canonical_field_id === metadataEntry.canonical_field_id, "E_MAP_METADATA_AUTHORITY", `canonical field metadata differs for ${sourceToken}`);
      requireCondition(canonicalJson(entry.metadata) === canonicalJson({
        type: metadataEntry.type,
        unit: metadataEntry.unit,
        scope: metadataEntry.scope,
        required: metadataEntry.required,
      }), "E_MAP_METADATA_AUTHORITY", `metadata differs for field-map entry ${index}`);
    }
  }
  const schema = JSON.parse(readFileSync(new URL("./contracts/template-field-map.schema.v1.json", import.meta.url), "utf8"));
  const schemaErrors = validateJsonSchema(fieldMap, schema);
  requireCondition(schemaErrors.length === 0, "E_MAP_SCHEMA", schemaErrors.join("; "));
  return fieldMap;
}

export function assertTemplateBinding(manifest, grammar, metadata, sourceSha256, documentXmlSha256) {
  requireCondition(manifest?.schema_version === "template-freeze-manifest/v1", "E_MANIFEST_VERSION", "unsupported freeze manifest");
  requireCondition(manifest.template?.immutable === true, "E_MANIFEST_BOUNDARY", "template must be immutable");
  requireCondition(manifest.template?.sha256 === sourceSha256, "E_TEMPLATE_DRIFT", `template bytes hash ${sourceSha256} differs from frozen hash ${manifest.template?.sha256}`);
  requireCondition(manifest.template?.document_xml_sha256 === documentXmlSha256, "E_TEMPLATE_DRIFT", "word/document.xml hash differs from frozen hash");
  requireCondition(grammar.template_sha256 === sourceSha256, "E_GRAMMAR_HASH", "grammar is bound to another template");
  requireCondition(metadata.template_sha256 === sourceSha256, "E_METADATA_HASH", "metadata is bound to another template");
  return true;
}
