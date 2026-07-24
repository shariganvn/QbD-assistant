import {
  Document,
  ExternalHyperlink,
  FootnoteReference,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import { determinizeDocx } from "./determinize-ooxml.mjs";

function citationText(citation) {
  return `${citation.source} — ${citation.location}. ${citation.excerpt}`;
}

function buildFootnotes(citations) {
  return Object.fromEntries(citations.map((citation, index) => {
    const run = citation.evidenceLink
      ? new ExternalHyperlink({
        children: [new TextRun({ text: citationText(citation), style: "Hyperlink", size: 18 })],
        link: citation.evidenceLink,
      })
      : new TextRun({ text: citationText(citation), size: 18 });
    return [index + 1, { children: [new Paragraph({ children: [run] })] }];
  }));
}

function buildParagraph(block) {
  const children = Object.hasOwn(block, "segments")
    ? block.segments.flatMap((segment) => (Object.hasOwn(segment, "citation")
      ? [new TextRun(`[${segment.citation + 1}]`), new FootnoteReference(segment.citation + 1)]
      : [new TextRun(segment.text)]))
    : [new TextRun(block.text)];
  return new Paragraph({ children });
}

function buildSourcesSection(citations) {
  const heading = new Paragraph({
    children: [new TextRun({ text: "Sources and provenance", bold: true, size: 24 })],
    heading: HeadingLevel.HEADING_1,
  });
  const entries = citations.map((citation, index) => {
    const children = [
      new TextRun({ text: `[${index + 1}] `, bold: true }),
      new TextRun(`${citation.evidenceId} — ${citation.source} — ${citation.location} — "${citation.excerpt}"`),
    ];
    if (citation.evidenceLink) {
      children.push(
        new TextRun("  "),
        new ExternalHyperlink({
          children: [new TextRun({ text: "USP reference", style: "Hyperlink" })],
          link: citation.evidenceLink,
        }),
      );
    }
    return new Paragraph({ children });
  });
  return [heading, ...entries];
}

function buildTable(block) {
  const tableWidthTwips = 9000;
  const columnWidths = block.headers.map((_, index) => (
    Math.floor((tableWidthTwips * (index + 1)) / block.headers.length)
      - Math.floor((tableWidthTwips * index) / block.headers.length)
  ));
  const header = new TableRow({
    children: block.headers.map((text, index) => new TableCell({
      width: { size: columnWidths[index], type: WidthType.DXA },
      children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
    })),
  });
  const rows = block.rows.map((row) => new TableRow({
    children: row.map((text, index) => new TableCell({
      width: { size: columnWidths[index], type: WidthType.DXA },
      children: [new Paragraph(text)],
    })),
  }));
  return new Table({
    rows: [header, ...rows],
    width: { size: tableWidthTwips, type: WidthType.DXA },
    columnWidths,
    layout: TableLayoutType.FIXED,
  });
}

function buildBlock(block) {
  switch (block.type) {
    case "heading1":
      return new Paragraph({ children: [new TextRun({ text: block.text, bold: true, size: 24 })], heading: HeadingLevel.HEADING_1 });
    case "heading2":
      return new Paragraph({ children: [new TextRun({ text: block.text, bold: true, size: 22 })], heading: HeadingLevel.HEADING_2 });
    case "heading3":
      return new Paragraph({ children: [new TextRun({ text: block.text, bold: true, size: 20 })], heading: HeadingLevel.HEADING_3 });
    case "paragraph":
      return buildParagraph(block);
    case "table":
      return buildTable(block);
    case "chờ_dữ_liệu":
      return new Paragraph({
        children: [
          new TextRun({ text: "⏳ Chờ dữ liệu: ", bold: true, color: "FF8800" }),
          new TextRun(block.text),
        ],
      });
  }
}

export async function buildDocumentBuffer(draft) {
  const children = [];
  const tocLevels = { heading1: 1, heading2: 2, heading3: 3 };
  const staticToc = draft.blocks
    .filter((block) => block.type in tocLevels)
    .map((block) => new Paragraph({
      children: [new TextRun(block.text)],
      indent: { left: (tocLevels[block.type] - 1) * 360 },
    }));
  if (draft.title) {
    children.push(new Paragraph({
      children: [new TextRun({ text: draft.title, bold: true, size: 28 })],
      heading: HeadingLevel.TITLE,
    }));
  }
  children.push(
    new Paragraph({ children: [new TextRun({ text: "Mục lục", bold: true, size: 24 })], heading: HeadingLevel.HEADING_1 }),
    new TableOfContents("Mục lục", { hyperlink: true, headingStyleRange: "1-3" }),
    ...staticToc,
  );
  children.push(...draft.blocks.map(buildBlock));
  children.push(...buildSourcesSection(draft.citations));
  const rawBuffer = await Packer.toBuffer(new Document({
    features: { updateFields: true },
    footnotes: buildFootnotes(draft.citations),
    sections: [{ properties: { page: { pageNumbers: { start: 1 } } }, children }],
  }));
  // Post-process to replace random relationship IDs with deterministic ones
  return determinizeDocx(rawBuffer);
}
