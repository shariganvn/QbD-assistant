import {
  Document,
  ExternalHyperlink,
  FootnoteReference,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

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
    ? block.segments.map((segment) => (Object.hasOwn(segment, "citation")
      ? new FootnoteReference(segment.citation + 1)
      : new TextRun(segment.text)))
    : [new TextRun(block.text)];
  return new Paragraph({ children });
}

function buildTable(block) {
  const width = Math.floor(100 / block.headers.length);
  const header = new TableRow({
    children: block.headers.map((text) => new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
    })),
  });
  const rows = block.rows.map((row) => new TableRow({
    children: row.map((text) => new TableCell({ children: [new Paragraph(text)] })),
  }));
  return new Table({ rows: [header, ...rows] });
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
  if (draft.title) {
    children.push(new Paragraph({
      children: [new TextRun({ text: draft.title, bold: true, size: 28 })],
      heading: HeadingLevel.TITLE,
    }));
  }
  children.push(
    new Paragraph({ children: [new TextRun({ text: "Mục lục", bold: true, size: 24 })], heading: HeadingLevel.HEADING_1 }),
    new TableOfContents("Mục lục", { hyperlink: true, headingStyleRange: "1-3" }),
  );
  children.push(...draft.blocks.map(buildBlock));
  return Packer.toBuffer(new Document({
    features: { updateFields: true },
    footnotes: buildFootnotes(draft.citations),
    sections: [{ properties: { page: { pageNumbers: { start: 1 } } }, children }],
  }));
}
