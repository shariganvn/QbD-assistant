/**
 * table-reconstruction.mjs — Best-effort deterministic table reconstruction.
 *
 * Cluster textItems by y (rows) and x (columns) to rebuild a grid.
 * Returns { headers, rows } if successful, null otherwise.
 */

/**
 * Attempt to reconstruct a table from textItems within a text segment.
 * @param {Array} textItems — liteparse textItems with { text, x, y }
 * @param {{ text: string, offset: number }} segment
 * @returns {{ headers: string[], rows: string[][] } | null}
 */
export function reconstructTable(textItems, segment) {
  if (!textItems || textItems.length === 0) return null;

  // Find textItems whose text overlaps with the segment
  const segLower = segment.text.toLowerCase();
  const segItems = textItems.filter((item) => {
    const itemText = (item.text || "").trim();
    return itemText.length > 0 && segLower.includes(itemText.toLowerCase().slice(0, 20));
  });

  if (segItems.length < 4) return null; // Need at least 2×2

  // Cluster by y (rows) — items within 8px y-gap are same row
  const ySorted = [...segItems].sort((a, b) => a.y - b.y);
  const rows = [];
  let currentRow = [ySorted[0]];

  for (let i = 1; i < ySorted.length; i++) {
    if (Math.abs(ySorted[i].y - currentRow[0].y) < 8) {
      currentRow.push(ySorted[i]);
    } else {
      rows.push(currentRow);
      currentRow = [ySorted[i]];
    }
  }
  rows.push(currentRow);

  if (rows.length < 2) return null;

  // Sort each row by x position
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
  }

  // First row = headers
  const headers = rows[0].map((item) => item.text.trim());
  const dataRows = rows.slice(1).map((row) => row.map((item) => item.text.trim()));

  // Validate: all rows should have same column count
  const colCount = headers.length;
  const validRows = dataRows.filter((r) => r.length === colCount);

  if (validRows.length < 1) return null;

  return { headers, rows: validRows };
}

/**
 * Split page text into meaningful segments (paragraphs).
 * Returns array of { text, offset }.
 * @param {string} text — full page text
 * @returns {{ text: string, offset: number }[]}
 */
export function splitIntoSegments(text) {
  const segments = [];
  const parts = text.split(/\n{2,}/);
  let offset = 0;

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length === 0) {
      offset += part.length + 2;
      continue;
    }

    const foundAt = text.indexOf(trimmed, Math.max(0, offset - 10));
    if (foundAt === -1) {
      // Not found — keep the computed offset (don't reset cursor to -1)
      segments.push({ text: trimmed, offset });
      offset += trimmed.length + 2;
    } else {
      segments.push({ text: trimmed, offset: foundAt });
      offset = foundAt + trimmed.length;
    }
  }

  return segments;
}
