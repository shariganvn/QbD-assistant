// Stage C renderer: (validated draft JSON, outline JSON) -> docx Buffer.
//
// Independent of cowork-p2-kit/render/document-builder.mjs by design — see
// docs/decisions/D20260825-pharma-dev-draft-tool-boundary.md. The scope-notice box text is a
// fixed constant below, not settable from the draft, so no caller can produce output from this
// tool that omits the "internal draft, not FD-approved" framing.

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, AlignmentType, VerticalAlign,
} from "docx";

const TABLE_WIDTH = 10000;
const HEADER_FILL = "D9D9D9";
const NOTICE_FILL = "FFF2CC";
const GAP_COLOR = "C00000";

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
const allBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

const SCOPE_NOTICE_TITLE = "Lưu ý phạm vi tài liệu";
const SCOPE_NOTICE_BODY_1 =
  "Tài liệu này là bản tổng hợp nội bộ, được soạn theo khung mục CTD 3.2.P.2 dựa trên nguồn dữ " +
  "liệu do người dùng cung cấp. Các mục không có dữ liệu nguồn được đánh dấu rõ " +
  "\"[CHƯA CÓ DỮ LIỆU – CẦN BỔ SUNG]\" thay vì suy diễn hoặc điền số liệu giả định.";
const SCOPE_NOTICE_BODY_2 =
  "Tài liệu KHÔNG phải hồ sơ P.2.2/P.2.3 đã phê duyệt, không thay thế thẩm định của bộ phận Phát " +
  "triển sản phẩm (FD)/QA, và không được dùng để nộp hồ sơ đăng ký cho đến khi được rà soát, bổ " +
  "sung dữ liệu và phê duyệt chính thức bởi FD.";
const DRAFT_STATUS_LABEL = "Trạng thái: BẢN NHÁP NỘI BỘ – CHƯA THẨM ĐỊNH";

const ABBREVIATIONS = [
  ["API", "Active Pharmaceutical Ingredient – Dược chất"],
  ["BCS", "Biopharmaceutics Classification System – Hệ thống phân loại sinh dược học"],
  ["CQA", "Critical Quality Attribute – Thuộc tính chất lượng trọng yếu"],
  ["CT", "Công thức (Formula)"],
  ["CU", "Content Uniformity – Độ đồng đều hàm lượng"],
  ["IPC", "In-Process Control – Kiểm soát trong quá trình"],
  ["LOD", "Loss on Drying – Độ ẩm/hao hụt khi sấy"],
  ["QTPP", "Quality Target Product Profile – Hồ sơ chất lượng mục tiêu sản phẩm"],
  ["RMP", "Reference Medicinal Product – Sản phẩm đối chiếu"],
  ["RSD", "Relative Standard Deviation – Độ lệch chuẩn tương đối"],
];

function cellText(text, opts = {}) {
  return new TableCell({
    width: { size: opts.width || 1000, type: WidthType.DXA },
    borders: allBorders,
    shading: opts.header ? { type: ShadingType.CLEAR, fill: HEADER_FILL } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: [new TextRun({ text: String(text), bold: !!opts.header, size: opts.size || 20 })],
    })],
  });
}

function makeTable(headers, rows, widths) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => cellText(h, { header: true, width: widths[i], align: AlignmentType.CENTER })),
  });
  const bodyRows = rows.map((r) => new TableRow({
    children: r.map((c, i) => cellText(c, { width: widths[i], align: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER })),
  }));
  return new Table({ width: { size: TABLE_WIDTH, type: WidthType.DXA }, columnWidths: widths, rows: [headerRow, ...bodyRows] });
}

// Column widths sum to TABLE_WIDTH; first column gets extra room for labels, remaining columns
// split the rest evenly. Works for draft tables of arbitrary column count (unlike the hand-written
// scratchpad version, which had one hardcoded width array per specific table).
function widthsFor(headerCount) {
  if (headerCount <= 1) return [TABLE_WIDTH];
  const firstColumn = Math.round(TABLE_WIDTH * 0.34);
  const remaining = TABLE_WIDTH - firstColumn;
  const otherColumn = Math.floor(remaining / (headerCount - 1));
  const widths = [firstColumn];
  for (let i = 1; i < headerCount - 1; i++) widths.push(otherColumn);
  widths.push(remaining - otherColumn * (headerCount - 2));
  return widths;
}

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 }, children: [new TextRun({ text })] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 260, after: 120 }, children: [new TextRun({ text })] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 }, children: [new TextRun({ text })] });
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
    children: [new TextRun({ text: `[CHƯA CÓ DỮ LIỆU – CẦN BỔ SUNG] ${text}`, bold: true, italics: true, color: GAP_COLOR, size: 20 })],
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

function renderBlock(block) {
  switch (block.type) {
    case "heading2": return [h2(block.text)];
    case "heading3": return [h3(block.text)];
    case "paragraph": return [bodyParagraph(block.text, { italic: block.italic, bold: block.bold })];
    case "table": return [makeTable(block.headers, block.rows, widthsFor(block.headers.length))];
    default: throw new Error(`unknown block type: ${block.type}`);
  }
}

function gapRegisterTable(outline, draftSectionsById) {
  const rows = outline.sections.map((section) => {
    const draftSection = draftSectionsById.get(section.id);
    const status = draftSection?.status === "covered" ? "Có dữ liệu (một phần hoặc đầy đủ)" : "Không có dữ liệu";
    const note = draftSection?.status === "gap" ? draftSection.gapReason : "—";
    return [`${section.ctdReference} ${section.headingVi}`, status, note];
  });
  return makeTable(["Mục CTD", "Trạng thái dữ liệu", "Ghi chú"], rows, [4200, 2400, 3400]);
}

export async function buildDocumentBuffer(draft, outline) {
  const draftSectionsById = new Map(draft.sections.map((section) => [section.id, section]));
  const children = [];

  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "BÁO CÁO PHÁT TRIỂN DƯỢC HỌC", bold: true, size: 32 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "(PHARMACEUTICAL DEVELOPMENT – CTD 3.2.P.2)", bold: true, size: 24, color: "555555" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: `${draft.meta.productName} — Dược chất: ${draft.meta.apiName}`, bold: true, size: 22 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: `Cơ sở dữ liệu: ${draft.meta.sourceFile}`, size: 20, italics: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: `${DRAFT_STATUS_LABEL} — Ngày soạn: ${draft.meta.draftDate}`, bold: true, size: 20, color: GAP_COLOR })] }),
  );

  children.push(noticeBox());
  children.push(spacer());

  children.push(h2("Danh mục chữ viết tắt"));
  children.push(makeTable(["Viết tắt", "Giải thích"], ABBREVIATIONS, [2500, 7500]));
  children.push(spacer());

  children.push(h1("3.2.P.2 PHÁT TRIỂN DƯỢC HỌC (PHARMACEUTICAL DEVELOPMENT)"));

  for (const outlineSection of outline.sections) {
    children.push(h1(`${outlineSection.ctdReference} ${outlineSection.headingVi.toUpperCase()}`));
    const draftSection = draftSectionsById.get(outlineSection.id);
    if (!draftSection || draftSection.status === "gap") {
      children.push(gapParagraph(draftSection?.gapReason ?? "Không có dữ liệu cho mục này."));
      continue;
    }
    for (const block of draftSection.blocks) {
      children.push(...renderBlock(block));
    }
  }

  children.push(h1("BẢNG TỔNG HỢP KHOẢNG TRỐNG DỮ LIỆU"));
  children.push(bodyParagraph("Tổng hợp mức độ sẵn sàng dữ liệu theo từng mục CTD, phục vụ lập kế hoạch bổ sung dữ liệu tiếp theo."));
  children.push(gapRegisterTable(outline, draftSectionsById));

  children.push(spacer());
  children.push(h2("Ghi nhận soạn thảo và rà soát"));
  children.push(makeTable(
    ["Vai trò", "Họ tên", "Ngày", "Chữ ký"],
    [
      [`Soạn thảo (${draft.meta.preparer})`, "—", draft.meta.draftDate, ""],
      ["Rà soát FD", "________________", "________________", ""],
      ["Phê duyệt QA/PO", "________________", "________________", ""],
    ],
    [3600, 2400, 2400, 1600],
  ));

  const doc = new Document({
    sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 900, right: 900 } } }, children }],
  });
  return Packer.toBuffer(doc);
}
