// Stage C renderer: (validated draft JSON, outline JSON) -> docx Buffer.
//
// Independent of cowork-p2-kit/render/document-builder.mjs by design — see
// docs/decisions/D20260825-pharma-dev-draft-tool-boundary.md. The scope-notice box text is a
// fixed constant below, not settable from the draft, so no caller can produce output from this
// tool that omits the "internal draft, not FD-approved" framing.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, AlignmentType, VerticalAlign, LevelFormat, ImageRun,
} from "docx";

import { TABLE_WIDTH_DXA as TABLE_WIDTH } from "../schemas/layout.mjs";
import { DECISION_LABEL, GAP_LABEL, isMarkedText } from "../schemas/markers.mjs";
import { tableValueCells } from "../schemas/table-shape.mjs";
import { printableRequestRows } from "./data-request.mjs";
import { printableDecisionRows } from "./decision-register.mjs";
import { barChartPng } from "./figures/bar-chart.mjs";
import { processFlowPng } from "./figures/process-flow.mjs";
import { barSeries, flowSteps } from "./figures/figure-source.mjs";

const HEADER_FILL = "D9D9D9";
const NOTICE_FILL = "FFF2CC";
const GAP_COLOR = "C00000";

// The renderer's own tables (not driven by a draft) declare their widths here, named, so one test
// can assert they all still fill TABLE_WIDTH if that budget ever changes.
export const FIXED_TABLE_WIDTHS = {
  dataRequest: [2000, 1900, 800, 5300],
  decisionRegister: [2000, 1900, 1000, 5100],
  gapRegister: [4200, 2400, 3400],
  abbreviations: [2500, 7500],
  signoff: [3600, 2400, 2400, 1600],
};

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
const allBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

const SCOPE_NOTICE_TITLE = "Lưu ý phạm vi tài liệu";
const SCOPE_NOTICE_BODY_1 =
  "Tài liệu này là bản tổng hợp nội bộ, được soạn theo khung mục CTD 3.2.P.2 dựa trên nguồn dữ " +
  "liệu do người dùng cung cấp. Các mục không có dữ liệu nguồn được đánh dấu rõ " +
  `"${GAP_LABEL}" thay vì suy diễn hoặc điền số liệu giả định. Những chỗ dữ liệu đã có nhưng hai ` +
  "nguồn không khớp, hoặc một giả định đang dùng mà chưa được phê duyệt, mang dấu riêng " +
  `"${DECISION_LABEL}" — loại này không đóng được bằng phép đo, phải có người quyết. Cuối tài liệu ` +
  "có hai danh mục tương ứng, cả hai sinh từ chính các dấu trong tài liệu.";
const SCOPE_NOTICE_BODY_2 =
  "Tài liệu KHÔNG phải hồ sơ P.2.2/P.2.3 đã phê duyệt, không thay thế thẩm định của bộ phận Phát " +
  "triển sản phẩm (FD)/QA, và không được dùng để nộp hồ sơ đăng ký cho đến khi được rà soát, bổ " +
  "sung dữ liệu và phê duyệt chính thức bởi FD.";
const DRAFT_STATUS_LABEL = "Trạng thái: BẢN NHÁP NỘI BỘ – CHƯA THẨM ĐỊNH";

// One Word list definition, referenced by every bulleted line in every cell. Registered on the
// Document below; without that registration the paragraphs render unbulleted.
const CELL_BULLET_REFERENCE = "cell-bullet";
const CELL_BULLET_PREFIX = "- ";

const NUMBERING_CONFIG = {
  config: [{
    reference: CELL_BULLET_REFERENCE,
    levels: [{
      level: 0,
      format: LevelFormat.BULLET,
      text: "\u2022",
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 180, hanging: 180 } } },
    }],
  }],
};

// A newline in cell text starts a new paragraph inside the cell, and a line opening with "- "
// becomes a real Word list item rather than a literal bullet character — matching how the
// department's reference table is built. Word ignores "\n" inside a single run, so splitting here
// is what actually produces the line break.
function cellText(text, opts = {}) {
  const lines = String(text).split("\n");
  return new TableCell({
    width: { size: opts.width || 1000, type: WidthType.DXA },
    borders: allBorders,
    shading: opts.header ? { type: ShadingType.CLEAR, fill: HEADER_FILL } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: lines.map((line, index) => {
      const bulleted = line.startsWith(CELL_BULLET_PREFIX);
      return new Paragraph({
        alignment: opts.align || AlignmentType.LEFT,
        spacing: { after: index === lines.length - 1 ? 0 : 40 },
        numbering: bulleted ? { reference: CELL_BULLET_REFERENCE, level: 0 } : undefined,
        children: [new TextRun({
          text: bulleted ? line.slice(CELL_BULLET_PREFIX.length) : line,
          bold: !!opts.header,
          size: opts.size || 20,
        })],
      });
    }),
  });
}

const ALIGNMENTS = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  justify: AlignmentType.JUSTIFIED,
};

// `align` is an optional per-column array of "left"/"center"/"justify". Without it, the first
// column is left-aligned and the rest centred — right for short numeric tables, wrong for prose.
// `headerless` suppresses the header row for label/value forms, where the left column already
// names each row and a "Property | Value" strip would only add noise. The headers still define the
// columns; they just are not printed.
function makeTable(headers, rows, widths, align, headerless) {
  const alignFor = (i) => (align ? ALIGNMENTS[align[i]] : (i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER));
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => cellText(h, { header: true, width: widths[i], align: AlignmentType.CENTER })),
  });
  const bodyRows = rows.map((r) => new TableRow({
    children: r.map((c, i) => cellText(c, { width: widths[i], align: alignFor(i) })),
  }));
  return new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: headerless ? bodyRows : [headerRow, ...bodyRows],
  });
}

// Default when a table block declares no columnWidths: widths sum to TABLE_WIDTH; first column
// gets extra room for labels, remaining columns split the rest evenly. Works for draft tables of
// arbitrary column count (unlike the hand-written scratchpad version, which had one hardcoded
// width array per specific table).
export function widthsFor(headerCount) {
  if (headerCount <= 1) return [TABLE_WIDTH];
  const firstColumn = Math.round(TABLE_WIDTH * 0.34);
  const remaining = TABLE_WIDTH - firstColumn;
  const otherColumn = Math.floor(remaining / (headerCount - 1));
  const widths = [firstColumn];
  for (let i = 1; i < headerCount - 1; i++) widths.push(otherColumn);
  widths.push(remaining - otherColumn * (headerCount - 2));
  return widths;
}

// Heading level comes from how deep a section sits in the CTD numbering, not from a table mapping
// section ids to levels. A map would be a second place the document's shape is written down, and it
// would go stale the first time the outline gained a section. Word offers six built-in heading levels,
// so the deepest numbering the form reaches is clamped to the last of them.
const DOCUMENT_ROOT_REFERENCE = "3.2.P.2";
const HEADING_LEVELS = [
  HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6,
];
const MAX_HEADING_LEVEL = HEADING_LEVELS.length;

export function headingLevelFor(ctdReference) {
  const suffix = String(ctdReference).startsWith(DOCUMENT_ROOT_REFERENCE)
    ? String(ctdReference).slice(DOCUMENT_ROOT_REFERENCE.length)
    : "";
  const depth = suffix.split(".").filter(Boolean).length;
  return Math.min(depth + 1, MAX_HEADING_LEVEL);
}

// Spacing tapers with depth so the hierarchy reads on the page as well as in the navigation pane.
function heading(level, text) {
  const clamped = Math.min(Math.max(level, 1), MAX_HEADING_LEVEL);
  const before = Math.max(340 - clamped * 40, 140);
  return new Paragraph({
    heading: HEADING_LEVELS[clamped - 1],
    spacing: { before, after: Math.round(before / 2) },
    children: [new TextRun({ text })],
  });
}

function h1(text) {
  return heading(1, text);
}
function h2(text) {
  return heading(2, text);
}
function bodyParagraph(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 140 },
    children: [new TextRun({ text, italics: !!opts.italic, bold: !!opts.bold })],
  });
}
function gapParagraph(text) {
  return new Paragraph({
    spacing: { after: 160 },
    children: [new TextRun({ text: `${GAP_LABEL} ${text}`, bold: true, italics: true, color: GAP_COLOR, size: 20 })],
  });
}
function spacer() {
  return new Paragraph({ text: "", spacing: { after: 80 } });
}

function noticeBox() {
  return new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: [TABLE_WIDTH],
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: TABLE_WIDTH, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: NOTICE_FILL },
        borders: allBorders,
        children: [
          new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: SCOPE_NOTICE_TITLE, bold: true, size: 20 })] }),
          new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: SCOPE_NOTICE_BODY_1, size: 19 })] }),
          new Paragraph({ children: [new TextRun({ text: SCOPE_NOTICE_BODY_2, size: 19, bold: true })] }),
        ],
      })],
    })],
  });
}

const toolRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// A figure is 96 dpi at the size it was laid out, then held to the text width so a wide process flow
// does not run into the margin.
const MAX_FIGURE_WIDTH_PT = 468;

function figureParagraphs(png, width, height, caption, counter) {
  const scale = Math.min(1, MAX_FIGURE_WIDTH_PT / width);
  counter.count += 1;
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 60 },
      children: [new ImageRun({
        type: "png",
        data: png,
        transformation: { width: Math.round(width * scale), height: Math.round(height * scale) },
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: `Hình ${counter.count}. ${caption}`, italics: true, size: 19 })],
    }),
  ];
}

function renderFigure(block, section, counter) {
  if (block.kind === "flow") {
    const { png, width, height } = processFlowPng(flowSteps(section, block));
    return figureParagraphs(png, width, height, block.caption, counter);
  }
  const series = barSeries(section, block);
  const threshold = block.threshold === undefined ? undefined : Number(String(block.threshold).replace(",", "."));
  const { png, width, height } = barChartPng(series, {
    threshold,
    thresholdLabel: block.thresholdLabel,
    axisLabel: block.axisLabel,
  });
  return figureParagraphs(png, width, height, block.caption, counter);
}

function renderImage(block, counter) {
  const png = readFileSync(join(toolRoot, block.path));
  const width = block.widthPt ?? 320;
  // Height is not declared: the draft says how wide the figure should sit and the renderer keeps the
  // file's own proportions, so a supplied image can never be silently stretched.
  const { width: pixelWidth, height: pixelHeight } = pngSize(png);
  const height = Math.round((width * pixelHeight) / pixelWidth);
  return figureParagraphs(png, width, height, block.caption, counter);
}

// PNG carries its dimensions in the IHDR chunk, always the first one, at a fixed offset.
function pngSize(buffer) {
  if (buffer.length < 24 || buffer.readUInt32BE(0) !== 0x89504e47) {
    throw new Error("supplied figure is not a PNG; only PNG dimensions can be read without an image library");
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function renderBlock(block, sectionLevel = 1, section = undefined, counter = { count: 0 }) {
  switch (block.type) {
    // Relative to the section, not absolute: the block type says how far below its own section the
    // heading sits, so a section's sub-heading can never come out ranking above the section itself.
    case "heading2": return [heading(sectionLevel + 1, block.text)];
    case "heading3": return [heading(sectionLevel + 2, block.text)];
    case "paragraph": return [bodyParagraph(block.text, { italic: block.italic, bold: block.bold })];
    case "table": return [makeTable(
      block.headers,
      block.rows,
      block.columnWidths ?? widthsFor(block.headers.length),
      block.columnAlign,
      block.headerless,
    )];
    case "figure": return renderFigure(block, section, counter);
    case "image": return renderImage(block, counter);
    default: throw new Error(`unknown block type: ${block.type}`);
  }
}

// A section whose tables are built out but hold nothing else is a form waiting to be filled, and
// the register has to say so: reporting it as holding data would be a false statement in a document
// shaped like a submission. What counts as marked comes from schemas/markers.mjs.

// Derived from the content rather than declared on the section, so it cannot go stale: the moment a real
// value replaces a marker, the register stops calling the section empty. Label columns do not count —
// a skeleton has its row labels filled in by definition, so counting them would report a form that
// holds nothing at all as holding data.
function tableCellsOf(section) {
  return (section.blocks ?? []).filter((block) => block.type === "table").flatMap(tableValueCells);
}

function paragraphsOf(section) {
  return (section.blocks ?? []).filter((block) => block.type === "paragraph").map((block) => block.text);
}

export function dataStatusLabel(section) {
  if (section?.status !== "covered") return "Không có dữ liệu";
  const cells = tableCellsOf(section);
  // A built-out form waiting to be filled is worth saying so, and it is the more useful of the two
  // empty states, so it is checked first.
  if (cells.length > 0 && cells.every((cell) => isMarkedText(cell))) return "Đã dựng khung, chưa có dữ liệu";
  // Otherwise a section whose every statement is a marker holds nothing. Paragraphs have to count here:
  // a section that says only "this data is missing" would otherwise be reported as holding data, which
  // is a false claim in a document shaped like a submission. An open decision counts as unsettled for
  // the same reason: "somebody still has to choose this" is not a statement of data.
  const everything = [...cells, ...paragraphsOf(section)];
  if (everything.length > 0 && everything.every((text) => isMarkedText(text))) return "Không có dữ liệu";
  return "Có dữ liệu (một phần hoặc đầy đủ)";
}

function gapRegisterTable(outline, draftSectionsById) {
  // Leaves only. A container carries a heading and no content, so it has no data status to report and
  // a row for it would state something untrue about a section that holds nothing by design.
  const rows = outline.sections.filter((section) => !section.container).map((section) => {
    const draftSection = draftSectionsById.get(section.id);
    const status = dataStatusLabel(draftSection);
    const note = draftSection?.status === "gap" ? draftSection.gapReason : "—";
    return [`${section.ctdReference} ${section.headingVi}`, status, note];
  });
  return makeTable(["Mục CTD", "Trạng thái dữ liệu", "Ghi chú"], rows, FIXED_TABLE_WIDTHS.gapRegister);
}

export async function buildDocumentBuffer(draft, outline) {
  const draftSectionsById = new Map(draft.sections.map((section) => [section.id, section]));
  // Figures are numbered across the whole document, in the order they are rendered.
  const figureCounter = { count: 0 };
  const children = [];

  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "BÁO CÁO PHÁT TRIỂN DƯỢC HỌC", bold: true, size: 32 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "(PHARMACEUTICAL DEVELOPMENT – CTD 3.2.P.2)", bold: true, size: 24, color: "555555" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: `${draft.meta.productName} — Dược chất: ${draft.meta.apiName}`, bold: true, size: 22 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: `Cơ sở dữ liệu: ${draft.meta.sourceFiles.join(" · ")}`, size: 20, italics: true })] }),
  );

  // The cover must name every source the document draws on, not just the trial file, so a reader
  // is never told the content traces back to one source when a section quotes a reference work.
  if (draft.meta.referenceSources) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: `Tài liệu tham chiếu: ${draft.meta.referenceSources.join("; ")}`, size: 20, italics: true })],
    }));
  }

  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: `${DRAFT_STATUS_LABEL} — Ngày soạn: ${draft.meta.draftDate}`, bold: true, size: 20, color: GAP_COLOR })] }),
  );

  children.push(noticeBox());
  children.push(spacer());

  children.push(h1("Danh mục chữ viết tắt"));
  children.push(makeTable(
    ["Viết tắt", "Giải thích"],
    // Sorted here rather than in the draft: the order is layout, and asking the draft to keep a
    // list alphabetical is asking for a list that drifts out of order.
    [...(draft.meta.abbreviations ?? [])].sort((a, b) => a[0].localeCompare(b[0], "vi")),
    FIXED_TABLE_WIDTHS.abbreviations,
  ));
  children.push(spacer());

  children.push(h1("3.2.P.2 PHÁT TRIỂN DƯỢC HỌC (PHARMACEUTICAL DEVELOPMENT)"));

  for (const outlineSection of outline.sections) {
    const level = headingLevelFor(outlineSection.ctdReference);
    children.push(heading(level, `${outlineSection.ctdReference} ${outlineSection.headingVi.toUpperCase()}`));
    if (outlineSection.container) continue;
    const draftSection = draftSectionsById.get(outlineSection.id);
    if (!draftSection || draftSection.status === "gap") {
      children.push(gapParagraph(draftSection?.gapReason ?? "Không có dữ liệu cho mục này."));
      continue;
    }
    for (const block of draftSection.blocks) {
      children.push(...renderBlock(block, level, draftSection, figureCounter));
    }
  }

  children.push(h1("BẢNG TỔNG HỢP KHOẢNG TRỐNG DỮ LIỆU"));
  children.push(bodyParagraph("Tổng hợp mức độ sẵn sàng dữ liệu theo từng mục CTD, phục vụ lập kế hoạch bổ sung dữ liệu tiếp theo."));
  children.push(gapRegisterTable(outline, draftSectionsById));

  children.push(spacer());
  children.push(h1("DANH MỤC DỮ LIỆU CẦN BỔ SUNG"));
  children.push(bodyParagraph(
    "Mỗi dòng dưới đây tương ứng một ô hoặc một câu đã đánh dấu trong tài liệu, và được sinh ra từ chính " +
    "dấu đó chứ không khai riêng — điền một giá trị thật vào tài liệu là dòng tương ứng tự biến mất. Cột " +
    "cuối là nguyên văn phần mô tả đi kèm dấu, nêu cần gì và lấy ở đâu. Trách nhiệm cung cấp thuộc bộ phận " +
    "Phát triển sản phẩm (FD), trừ những dòng mà chính nội dung dòng đó nêu bên khác (nhà cung cấp nguyên " +
    "liệu, QA, hoặc hồ sơ thuộc phần khác của bộ tài liệu).",
  ));
  const requestRows = printableRequestRows(draft, outline);
  children.push(makeTable(
    ["Mục CTD", "Hạng mục", "Hàm lượng", "Cần gì và lấy ở đâu"],
    requestRows,
    FIXED_TABLE_WIDTHS.dataRequest,
    ["left", "left", "center", "justify"],
  ));

  const decisionRows = printableDecisionRows(draft, outline);
  if (decisionRows.length > 0) {
    children.push(spacer());
    children.push(h1("DANH MỤC ĐIỂM CẦN QUYẾT ĐỊNH"));
    children.push(bodyParagraph(
      "Danh mục này khác danh mục trên ở bản chất việc phải làm. Ở trên là những chỗ CHƯA CÓ dữ liệu, " +
      "đóng lại bằng cách đo hoặc lấy hồ sơ. Ở đây là những chỗ dữ liệu ĐÃ CÓ nhưng hai nguồn không " +
      "khớp nhau, hoặc một giả định đang được dùng mà chưa được phê duyệt — không phép đo nào đóng " +
      "được, phải có người có thẩm quyền chọn. Mỗi dòng sinh từ chính dấu trong tài liệu; cột người " +
      "quyết đọc từ nguyên văn dấu đó.",
    ));
    children.push(makeTable(
      ["Mục CTD", "Hạng mục", "Ai quyết", "Điều phải quyết"],
      decisionRows,
      FIXED_TABLE_WIDTHS.decisionRegister,
      ["left", "left", "center", "justify"],
    ));
  }

  children.push(spacer());
  children.push(h1("Ghi nhận soạn thảo và rà soát"));
  children.push(makeTable(
    ["Vai trò", "Họ tên", "Ngày", "Chữ ký"],
    [
      [`Soạn thảo (${draft.meta.preparer})`, "—", draft.meta.draftDate, ""],
      ["Rà soát FD", "________________", "________________", ""],
      ["Phê duyệt QA/PO", "________________", "________________", ""],
    ],
    FIXED_TABLE_WIDTHS.signoff,
  ));

  const doc = new Document({
    numbering: NUMBERING_CONFIG,
    sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 900, right: 900 } } }, children }],
  });
  return Packer.toBuffer(doc);
}
