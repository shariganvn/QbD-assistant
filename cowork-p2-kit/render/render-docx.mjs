#!/usr/bin/env node

/**
 * render-docx.mjs — Layer C: deterministic .docx render via docx npm library.
 *
 * Takes a structured draft JSON (from Phase 4 SKILL output) and renders
 * it into outputs/p2-draft.docx with footnotes, hyperlinks, TOC, and tables.
 *
 * The LLM never writes the final .docx — this layer does.
 *
 * Remediation patch 2026-07-16:
 * - Footnote IDs start at 1 (not 0)
 * - Citation contract: optional evidenceLink (public URL only)
 * - ExternalHyperlink only for public URLs; local evidence = plain text
 * - Reject file:// / absolute-path link targets
 * - Demo mode: minimal smoke test from store/records.jsonl only
 *   (hard-coded decision matrix + formula-selection prose removed)
 *
 * Usage: npm run render
 *   or:  node cowork-p2-kit/render/render-docx.mjs [input.json]
 *
 * Input: structured draft JSON (stdin or file arg). If no input, renders
 *        a minimal demo from store/records.jsonl.
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  FootnoteReference, ExternalHyperlink, TableOfContents,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, TableLayoutType, PageNumber, Footer,
} from "docx";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KIT_DIR = resolve(__dirname, "..");
const OUTPUT_DIR = join(KIT_DIR, "outputs");
const OUTPUT_FILE = join(OUTPUT_DIR, "p2-draft.docx");

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Helpers ───────────────────────────────────────────────────────────

function fail(msg) {
  console.error(`FATAL: ${msg}`);
  process.exit(1);
}

/**
 * Validate a citation link. Returns true if valid (public URL) or null (no link).
 * Rejects file:// and absolute-path targets.
 */
function isValidPublicUrl(url) {
  if (!url) return null; // null = no link, valid (plain text)
  if (typeof url !== "string") return false;

  // Reject file:// and absolute paths
  if (url.startsWith("file://")) return false;
  if (url.startsWith("/") || /^[A-Z]:\\/i.test(url)) return false;

  // Must be http/https
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;

  return true;
}

// ─── Input handling ────────────────────────────────────────────────────

let draft;
const inputFile = process.argv[2];

if (inputFile && existsSync(inputFile)) {
  // Read structured draft from file
  draft = JSON.parse(readFileSync(inputFile, "utf-8"));
  console.log(`Reading draft from: ${inputFile}`);
} else {
  // Demo mode: minimal smoke test from store records
  console.log("No input file provided — rendering minimal demo from store/records.jsonl");
  draft = buildMinimalDemo();
}

// ─── Validate citations ────────────────────────────────────────────────

console.log("Validating citations...");

if (draft.citations) {
  for (let i = 0; i < draft.citations.length; i++) {
    const cit = draft.citations[i];

    // Check for file:// / absolute-path link targets
    if (cit.evidenceLink) {
      if (!isValidPublicUrl(cit.evidenceLink)) {
        fail(`Citation ${i + 1} has invalid link target (file:// or absolute path rejected): ${cit.evidenceLink}`);
      }
    }

    // Check for citable:false references in blocks
    // (This is a contract check — the renderer trusts the input but validates structure)
  }
}

// Validate inline citations reference defined citations
if (draft.blocks) {
  const citCount = draft.citations?.length || 0;
  for (const block of draft.blocks) {
    if (block.segments) {
      for (const seg of block.segments) {
        if (seg.citation !== undefined) {
          if (seg.citation < 0 || seg.citation >= citCount) {
            fail(`Inline citation references undefined citation index ${seg.citation} (only ${citCount} defined)`);
          }
        }
      }
    }
  }
}

console.log(`  ${draft.citations?.length || 0} citations validated`);

// ─── Render ────────────────────────────────────────────────────────────

console.log("Rendering p2-draft.docx...");

const footnotes = {};

// Build footnotes from citations — IDs start at 1 (not 0)
if (draft.citations) {
  for (let i = 0; i < draft.citations.length; i++) {
    const cit = draft.citations[i];
    const footnoteId = i + 1; // Start at 1, not 0

    const footnoteContent = [];

    if (cit.evidenceLink && isValidPublicUrl(cit.evidenceLink)) {
      // Public URL → render as ExternalHyperlink
      footnoteContent.push(
        new ExternalHyperlink({
          children: [
            new TextRun({
              text: `${cit.source} — ${cit.location}${cit.excerpt ? `. ${cit.excerpt}` : ""}`,
              style: "Hyperlink",
              size: 18,
            }),
          ],
          link: cit.evidenceLink,
        })
      );
    } else {
      // Local-only or no link → plain text (no file:// link)
      footnoteContent.push(
        new TextRun({
          text: `${cit.source} — ${cit.location}${cit.excerpt ? `. ${cit.excerpt}` : ""}`,
          size: 18,
        })
      );
    }

    footnotes[footnoteId] = { children: [new Paragraph({ children: footnoteContent })] };
  }
}

// Build document sections
const children = [];

// Title
if (draft.title) {
  children.push(
    new Paragraph({
      children: [new TextRun({ text: draft.title, bold: true, size: 28 })],
      heading: HeadingLevel.TITLE,
    })
  );
}

// TOC
children.push(
  new Paragraph({
    children: [new TextRun({ text: "Mục lục", bold: true, size: 24 })],
    heading: HeadingLevel.HEADING_1,
  }),
  new TableOfContents("Mục lục", {
    hyperlink: true,
    headingStyleRange: "1-3",
  })
);

// Process headings and prose
for (const block of draft.blocks || []) {
  switch (block.type) {
    case "heading1":
      children.push(
        new Paragraph({
          children: [new TextRun({ text: block.text, bold: true, size: 24 })],
          heading: HeadingLevel.HEADING_1,
        })
      );
      break;

    case "heading2":
      children.push(
        new Paragraph({
          children: [new TextRun({ text: block.text, bold: true, size: 22 })],
          heading: HeadingLevel.HEADING_2,
        })
      );
      break;

    case "heading3":
      children.push(
        new Paragraph({
          children: [new TextRun({ text: block.text, bold: true, size: 20 })],
          heading: HeadingLevel.HEADING_3,
        })
      );
      break;

    case "paragraph": {
      const runs = [];
      if (block.segments) {
        for (const seg of block.segments) {
          if (seg.citation !== undefined) {
            // Inline footnote reference — citation index + 1 = footnote ID
            runs.push(new FootnoteReference(seg.citation + 1));
          } else {
            runs.push(new TextRun(seg.text || ""));
          }
        }
      } else {
        runs.push(new TextRun(block.text || ""));
      }
      children.push(new Paragraph({ children: runs }));
      break;
    }

    case "table": {
      const rows = [];
      // Header row
      if (block.headers) {
        rows.push(
          new TableRow({
            children: block.headers.map(
              (h) =>
                new TableCell({
                  width: { size: Math.floor(100 / block.headers.length), type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: h, bold: true })],
                    }),
                  ],
                })
            ),
          })
        );
      }
      // Data rows
      for (const row of block.rows || []) {
        rows.push(
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  children: [new Paragraph(String(cell))],
                })
            ),
          })
        );
      }
      children.push(new Table({ rows }));
      break;
    }

    case "chờ_dữ_liệu":
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "⏳ Chờ dữ liệu: ", bold: true, color: "FF8800" }),
            new TextRun(block.text || "Chưa có nguồn hỗ trợ cho mục này."),
          ],
        })
      );
      break;
  }
}

// Evidence log reference
if (draft.evidenceLog) {
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "\n" }),
        new TextRun({ text: "Nhật ký bằng chứng: ", bold: true }),
        new TextRun(draft.evidenceLog),
      ],
    })
  );
}

const doc = new Document({
  features: { updateFields: true },
  footnotes,
  sections: [
    {
      properties: {
        page: {
          pageNumbers: { start: 1 },
        },
      },
      children,
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync(OUTPUT_FILE, buffer);
console.log(`Written: ${OUTPUT_FILE} (${buffer.length} bytes)`);
console.log("Done.");

// ─── Minimal demo builder ─────────────────────────────────────────────

/**
 * Build a minimal demo draft from store/records.jsonl.
 * Only renders blocks provably cited from real store records.
 * No hard-coded decision matrix or formula-selection prose.
 * Missing data renders as chờ dữ liệu.
 */
function buildMinimalDemo() {
  const storePath = join(KIT_DIR, "store", "records.jsonl");
  if (!existsSync(storePath)) {
    console.error("No store/records.jsonl found. Run: npm run ingest");
    process.exit(1);
  }

  const records = readFileSync(storePath, "utf-8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));

  if (records.length === 0) {
    fail("Store is empty — cannot build demo");
  }

  const citations = [];
  const blocks = [];

  // Title
  blocks.push({ type: "heading1", text: "P.2.2 Phát triển bào chế (Formulation Development)" });
  blocks.push({ type: "heading2", text: "P.2.2.1 Tổng quan công thức" });

  // Extract citable text records only
  const citableRecords = records.filter(
    (r) => r.classification?.citable && r.extraction_status === "ok" && r.content?.trim()
  );

  if (citableRecords.length === 0) {
    blocks.push({
      type: "chờ_dữ_liệu",
      text: "Không có bản ghi nào được trích xuất từ dữ liệu thử nghiệm. Chạy: npm run ingest",
    });
  } else {
    // Use up to 3 citable records as evidence
    const usedRecords = citableRecords.slice(0, 3);
    for (const rec of usedRecords) {
      const citIdx = citations.length;
      citations.push({
        source: rec.provenance.file,
        location: `page ${rec.provenance.page}, offset ${rec.provenance.char_start}`,
        excerpt: rec.content.slice(0, 100),
        evidenceLink: null, // local evidence → plain text
      });
      blocks.push({
        type: "paragraph",
        segments: [
          { text: rec.content.slice(0, 200) },
          { citation: citIdx },
        ],
      });
    }
  }

  // Decision matrix — chờ dữ liệu (Phase 4's LLM output, not Layer C)
  blocks.push({ type: "heading2", text: "P.2.2.2 Ma trận quyết định (Decision Matrix)" });
  blocks.push({
    type: "chờ_dữ_liệu",
    text: "Ma trận quyết định cần dữ liệu từ Phase 4 (LLM reasoning). Layer C chỉ render — không tạo số liệu.",
  });

  // Formula selection — chờ dữ liệu
  blocks.push({ type: "heading2", text: "P.2.2.3 Lựa chọn công thức tối ưu" });
  blocks.push({
    type: "chờ_dữ_liệu",
    text: "Lựa chọn công thức cần phân tích từ Phase 4. Layer C chỉ render — không tạo nhận xét.",
  });

  // Process development — chờ dữ liệu
  blocks.push({ type: "heading1", text: "P.2.3 Phát triển quy trình (Process Development)" });
  blocks.push({
    type: "chờ_dữ_liệu",
    text: "Phát triển quy trình cần dữ liệu từ Phase 4. Layer C chỉ render — không tạo mô tả.",
  });

  return {
    title: "CTD P.2 — Phát triển dược học — Bisoprolol 5/10 mg",
    blocks,
    citations,
    evidenceLog: `${records.length} bản ghi từ store/records.jsonl, trích xuất bởi liteparse`,
  };
}
