import { ownerKey } from "./template-field-contract.mjs";

function blocks(xml, tag) {
  return [...xml.matchAll(new RegExp(`<w:${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/w:${tag}>`, "g"))]
    .map((match) => match[1]);
}

function xmlAttribute(xml, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return xml.match(new RegExp(`(?:^|\\s)${escaped}="([^"]*)"`))?.[1] ?? null;
}

function decodeXmlText(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

export function visibleText(xml) {
  const withBreaks = xml
    .replace(/<w:tab\s*\/?\s*>/g, "\t")
    .replace(/<w:(?:br|cr)(?:\s[^>]*)?\s*\/?\s*>/g, "\n");
  return [...withBreaks.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXmlText(match[1]))
    .join("");
}

function parseGridSpan(properties) {
  const gridSpan = properties.match(/<w:gridSpan(?:\s[^>]*)?\/?\s*>/);
  return Number(xmlAttribute(gridSpan?.[0] ?? "", "w:val") ?? 1);
}

function parseVerticalMerge(properties) {
  const merge = properties.match(/<w:vMerge(?:\s[^>]*)?\/?\s*>/);
  if (!merge) return "none";
  return xmlAttribute(merge[0], "w:val") ?? "continue";
}

function readTableOwners(documentXml) {
  const owners = new Map();
  for (const [tableOffset, tableXml] of blocks(documentXml, "tbl").entries()) {
    const activeMerges = new Map();
    for (const [rowOffset, rowXml] of blocks(tableXml, "tr").entries()) {
      let logicalColumn = 1;
      let physicalCell = 0;
      for (const cellXml of blocks(rowXml, "tc")) {
        physicalCell += 1;
        const properties = cellXml.match(/<w:tcPr(?:\s[^>]*)?>([\s\S]*?)<\/w:tcPr>/)?.[1] ?? "";
        const gridSpan = parseGridSpan(properties);
        const verticalState = parseVerticalMerge(properties);
        const mergeGroups = [...Array(gridSpan).keys()].map((offset) => activeMerges.get(logicalColumn + offset));
        let verticalGroupId = null;
        if (verticalState === "restart") {
          verticalGroupId = `VM-T${String(tableOffset + 1).padStart(2, "0")}-R${String(rowOffset + 1).padStart(2, "0")}-C${String(physicalCell).padStart(2, "0")}`;
          for (let offset = 0; offset < gridSpan; offset += 1) activeMerges.set(logicalColumn + offset, verticalGroupId);
        } else if (verticalState === "continue") {
          verticalGroupId = mergeGroups.length && new Set(mergeGroups).size === 1 ? mergeGroups[0] : null;
        } else {
          for (let offset = 0; offset < gridSpan; offset += 1) activeMerges.delete(logicalColumn + offset);
        }
        const owner = {
          kind: "cell",
          table: tableOffset + 1,
          row: rowOffset + 1,
          physical_cell: physicalCell,
          logical_column_start: logicalColumn,
          logical_column_end: logicalColumn + gridSpan - 1,
          grid_span: gridSpan,
          vertical_merge: { state: verticalState, group_id: verticalGroupId },
        };
        owners.set(ownerKey(owner), { owner, text: visibleText(cellXml) });
        logicalColumn += gridSpan;
      }
    }
  }
  return owners;
}

export function readOwnerTexts(documentXml) {
  const owners = readTableOwners(documentXml);
  const outsideTables = documentXml.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, "");
  for (const [paragraphOffset, paragraphXml] of blocks(outsideTables, "p").entries()) {
    const owner = { kind: "paragraph", paragraph: paragraphOffset + 1 };
    owners.set(ownerKey(owner), { owner, text: visibleText(paragraphXml) });
  }
  return owners;
}
