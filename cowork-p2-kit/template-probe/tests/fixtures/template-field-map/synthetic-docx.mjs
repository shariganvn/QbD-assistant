import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import JSZip from "jszip";

export const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function textRun(value) {
  return `<w:r><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;
}

export function paragraph(...runs) {
  return `<w:p>${runs.join("")}</w:p>`;
}

export function cell(content, properties = "") {
  return `<w:tc><w:tcPr>${properties}</w:tcPr>${content}</w:tc>`;
}

export function row(...cells) {
  return `<w:tr>${cells.join("")}</w:tr>`;
}

export function table(...rows) {
  return `<w:tbl><w:tblGrid><w:gridCol w:w="1000"/><w:gridCol w:w="1000"/></w:tblGrid>${rows.join("")}</w:tbl>`;
}

export function documentXml(body) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W_NS}"><w:body>${body}</w:body></w:document>`;
}

export async function createDocx(document) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<?xml version=\"1.0\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"/>");
  zip.file("word/document.xml", document);
  return zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function syntheticContract({ bytes, document, tokens, paragraphTokens = [] }) {
  const templateSha256 = sha256(bytes);
  const documentXmlSha256 = sha256(document);
  const declared = [...tokens, ...paragraphTokens];
  const exceptions = Object.fromEntries(paragraphTokens.map((token) => [token, {
    role: token === "CONCLUSION" ? "reference_only" : "supplied_data",
    required: token !== "CONCLUSION",
    write_allowed: false,
    derivation_allowed: false,
  }]));
  const grammar = {
    schema_version: "template-field-grammar/v1",
    template_sha256: templateSha256,
    visible_token: {
      open_delimiter: "<",
      close_delimiter: ">",
      semantic_id_pattern: "^[A-Z][A-Z0-9%-]*$",
      multiplicity: "exactly-once",
      unknown_token_policy: "reject",
      raw_display_policy: "preserve verbatim",
    },
    canonical_id_aliases: {},
    owner_policy: {
      default_kind: "cell",
      paragraph_exceptions: exceptions,
    },
    field_rules: {
      default_required: true,
      candidate_scope_pattern: "-CT0[1-3]$",
      percentage_indicator: "%",
      semantic_type: "raw_text",
      unit_policy: "Source-rendered labels only",
    },
    declared_anchor_ids: declared,
  };
  const metadata = {
    schema_version: "template-field-metadata/v1",
    template_version: "synthetic-template-v1",
    template_sha256: templateSha256,
    entries: declared.map((sourceToken) => ({
      source_token: sourceToken,
      canonical_field_id: sourceToken,
      type: "raw_text",
      unit: null,
      scope: sourceToken.endsWith("-CT01") ? "FORMULA-01" : "shared-context",
      required: sourceToken !== "CONCLUSION",
    })),
  };
  const manifest = {
    schema_version: "template-freeze-manifest/v1",
    template_version: "synthetic-template-v1",
    template: {
      source_path: "synthetic.docx",
      immutable: true,
      sha256: templateSha256,
      document_xml_sha256: documentXmlSha256,
    },
  };
  return { manifest, grammar, metadata };
}

export async function writeFixture(directory, name, document) {
  const bytes = await createDocx(document);
  const path = `${directory}/${name}`;
  await import("node:fs").then(({ writeFileSync, mkdirSync }) => {
    mkdirSync(directory, { recursive: true });
    writeFileSync(path, bytes);
  });
  return { path, bytes };
}

export function readFixture(path) {
  return readFileSync(path);
}
