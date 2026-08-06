import { createHash } from "node:crypto";

export const REAL_CANDIDATE = "demo-real-candidate";
export const COMPARATOR_CANDIDATE = "demo-comparator";
export const REAL_SOURCE_FILE = "inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx";
export const COMPARATOR_SOURCE_FILE = "inputs/demo-comparator/records.jsonl";
export const DEMO_COMPARATOR_MARKER = "demo-comparator";

const CRITICAL_MEASURES = [
  { id: "release_30m", value: 90 },
  { id: "assay", value: 110 },
];

function fail(code, message) {
  const error = new Error("[" + code + "] " + message);
  error.code = code;
  throw error;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function admittedRecordIds(evidenceLog) {
  return new Set(evidenceLog.entries.map((entry) => entry.record_id));
}

function recordFor(records, evidenceLog, sourceFile, predicate) {
  const admitted = admittedRecordIds(evidenceLog);
  const matches = records.filter((record) => admitted.has(record.id)
    && record.provenance?.file === sourceFile
    && predicate(record));
  if (matches.length !== 1) fail("E_DEMO_RECORD_BINDING", "expected one admitted record for " + sourceFile + ", found " + matches.length);
  return matches[0];
}

function cardFor({ id, record, candidate, measure, normalizedValue }) {
  const card = {
    id,
    record_id: record.id,
    candidate,
    measure,
    raw_text: normalizedValue + " %",
    normalized_value: normalizedValue,
    unit: "%",
    quote: record.content,
    char_start: 0,
    char_end: record.content.length,
    provenance: { file: record.provenance.file },
  };
  return card;
}

export function buildRealCandidateCards({ records, evidenceLog, candidate = REAL_CANDIDATE, sourceFile = REAL_SOURCE_FILE }) {
  const record = recordFor(
    records,
    evidenceLog,
    sourceFile,
    (entry) => entry.content.includes("bisoprolol fumarate") && /90\s+-\s+110%/.test(entry.content),
  );
  return CRITICAL_MEASURES.map(({ id, value }) => cardFor({
    id: "FC-DEMO-REAL-" + id.toUpperCase(),
    record,
    candidate,
    measure: id,
    normalizedValue: value,
  }));
}

export function buildComparatorRecords({ sourceFile = COMPARATOR_SOURCE_FILE } = {}) {
  const values = [
    ["demo-comparator-release-30m", "release_30m", 92],
    ["demo-comparator-assay", "assay", 96],
  ];
  return values.map(([id, measure, value]) => {
    const content = "SYNTHETIC DEMO COMPARATOR — " + measure + ": " + value + " %";
    return {
      id,
      source_type: "text",
      content,
      provenance: {
        file: sourceFile,
        page: 1,
        char_start: 0,
        char_end: content.length,
        quote: content,
        page_kind: "renderer-derived",
      },
      confidence: "high",
      extraction_status: "ok",
      classification: { label: "internal-derived", citable: false },
      demo_marker: DEMO_COMPARATOR_MARKER,
    };
  });
}

export function buildComparatorCards({
  records,
  evidenceLog,
  candidate = COMPARATOR_CANDIDATE,
  sourceFile = COMPARATOR_SOURCE_FILE,
} = {}) {
  return [
    ["release_30m", 92],
    ["assay", 96],
  ].map(([measure, value]) => {
    const record = recordFor(records, evidenceLog, sourceFile, (entry) => entry.content.includes(measure + ": " + value + " %"));
    return cardFor({
      id: "FC-DEMO-COMPARATOR-" + measure.toUpperCase(),
      record,
      candidate,
      measure,
      normalizedValue: value,
    });
  });
}

function receiptMatch(entry, records, sourceFile, storeRecordsSha256) {
  if (typeof entry.raw_value !== "string" || entry.raw_value.length === 0) {
    return { canonical_field_id: entry.canonical_field_id, status: "unmapped", matches: [], record_id: null, location: null, excerpt: null };
  }
  const matches = records.flatMap((record) => {
    if (record.provenance?.file !== sourceFile || record.content !== record.provenance?.quote) return [];
    const offsets = [];
    let offset = record.content.indexOf(entry.raw_value);
    while (offset >= 0) {
      offsets.push(offset);
      offset = record.content.indexOf(entry.raw_value, offset + entry.raw_value.length);
    }
    return offsets.map((relativeOffset) => ({ record, relativeOffset }));
  });
  if (matches.length > 1) {
    return {
      canonical_field_id: entry.canonical_field_id,
      status: "ambiguous",
      matches: matches.map(({ record }) => record.id),
      record_id: null,
      location: null,
      excerpt: null,
      store_records_sha256: storeRecordsSha256,
    };
  }
  if (matches.length === 0) {
    return { canonical_field_id: entry.canonical_field_id, status: "unmapped", matches: [], record_id: null, location: null, excerpt: null };
  }
  const [{ record, relativeOffset }] = matches;
  const charStart = record.provenance.char_start + relativeOffset;
  return {
    canonical_field_id: entry.canonical_field_id,
    status: "exact",
    matches: [record.id],
    record_id: record.id,
    location: "page " + record.provenance.page + ", offset " + charStart,
    excerpt: entry.raw_value,
    source: record.provenance.file,
    record_quote: record.provenance.quote,
    char_start: charStart,
    char_end: charStart + entry.raw_value.length,
    store_records_sha256: storeRecordsSha256,
  };
}

export function buildExactReceiptJoin({ receipt, records, sourceFile = REAL_SOURCE_FILE, storeRecordsSha256 } = {}) {
  if (!receipt || !Array.isArray(receipt.entries)) fail("E_RECEIPT_JOIN", "a template receipt with entries is required");
  if (!Array.isArray(records)) fail("E_RECEIPT_JOIN", "store records are required");
  if (typeof storeRecordsSha256 !== "string" || !/^[0-9a-f]{64}$/.test(storeRecordsSha256)) {
    fail("E_RECEIPT_STORE_HASH", "a canonical store SHA-256 is required");
  }
  if (storeHash(records) !== storeRecordsSha256) {
    fail("E_RECEIPT_STORE_HASH", "receipt join records do not match the supplied canonical store SHA-256");
  }
  const entries = receipt.entries.map((entry) => receiptMatch(entry, records, sourceFile, storeRecordsSha256));
  const counts = Object.fromEntries(["exact", "ambiguous", "unmapped"].map((status) => [status, entries.filter((item) => item.status === status).length]));
  if (counts.exact !== 3 || counts.ambiguous !== 0 || counts.unmapped !== 2) {
    fail("E_RECEIPT_JOIN_CARDINALITY", "expected 3/2/0 exact/ambiguous/unmapped, got "
      + counts.exact + "/" + counts.unmapped + "/" + counts.ambiguous);
  }
  return { entries, counts, store_records_sha256: storeRecordsSha256 };
}

export function buildCitationEnvelopes(join) {
  if (!join || !Array.isArray(join.entries)) fail("E_CITATION_JOIN", "an exact receipt join is required");
  return join.entries.filter((entry) => entry.status === "exact").map((entry) => ({
    evidenceId: "demo-" + entry.canonical_field_id.toLowerCase(),
    source: entry.source,
    location: entry.location,
    excerpt: entry.excerpt,
    classification: { label: "public", citable: true },
    evidenceLink: null,
  }));
}

export function buildDemoProfiles() {
  const profile = {
    api: "synthetic demo API profile",
    strength: "synthetic demo strength",
    dosage_form: "synthetic demo dosage form",
    product_target: "synthetic demo product target",
    trial_context: "synthetic demo trial context",
  };
  return {
    [REAL_CANDIDATE]: { ...profile },
    [COMPARATOR_CANDIDATE]: { ...profile },
  };
}

export function buildDemoCandidateMap({ realSourceFile = REAL_SOURCE_FILE, comparatorSourceFile = COMPARATOR_SOURCE_FILE } = {}) {
  return {
    [realSourceFile]: REAL_CANDIDATE,
    [comparatorSourceFile]: COMPARATOR_CANDIDATE,
  };
}

export function storeBytes(records) {
  return Buffer.from(records.map((record) => JSON.stringify(record)).join("\n") + "\n");
}

export function storeHash(records) {
  return sha256(storeBytes(records));
}
