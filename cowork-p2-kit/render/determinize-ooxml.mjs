import { createHash } from "node:crypto";
import JSZip from "jszip";

/**
 * Post-process a DOCX buffer to replace random relationship IDs with
 * deterministic ones scoped per .rels part.
 *
 * Each .rels file gets its own ID mapping derived from:
 *   SHA256(relsPath + "\0" + type + "\0" + target + "\0" + ordinal)[:16]
 *
 * This prevents cross-part ID collisions when two different .rels files
 * contain the same old relationship ID with different targets.
 */
export async function determinizeDocx(buffer) {
  const zip = await JSZip.loadAsync(buffer);

  // Step 1: Collect all .rels files
  const relsFiles = [];
  for (const [path, file] of Object.entries(zip.files)) {
    if (path.endsWith(".rels") && !file.dir) {
      relsFiles.push(path);
    }
  }

  // Step 2: Build per-part ID mappings
  // Each .rels part gets its own oldId -> newId map
  const partMappings = new Map(); // relsPath -> Map(oldId -> newId)
  const redundantHyperlinks = new Map(); // relsPath -> XML elements to remove after reference remapping

  for (const relsPath of relsFiles) {
    const file = zip.file(relsPath);
    const content = await file.async("string");
    const idMap = new Map();
    const seenNewIds = new Set();

    // Relationship attributes are unordered XML attributes. Keep the mapping local
    // to this .rels part and distinguish duplicate type/target relationships by
    // their ordinal within that otherwise-identical signature.
    const relRegex = /<Relationship\b([^>]*)\/?\s*>/g;
    let match;
    const signatureOrdinals = new Map();
    const seenOldIds = new Set();
    const canonicalHyperlinkIds = new Map();
    const redundant = [];
    while ((match = relRegex.exec(content)) !== null) {
      const attributes = Object.fromEntries([...match[1].matchAll(/([A-Za-z_:][A-Za-z0-9_.:-]*)="([^"]*)"/g)]
        .map((attribute) => [attribute[1], attribute[2]]));
      const { Id: oldId, Type: type, Target: target = "", TargetMode: targetMode = "" } = attributes;
      if (!oldId || !type) throw new Error(`malformed relationship in ${relsPath}`);
      if (seenOldIds.has(oldId)) throw new Error(`duplicate relationship ID in ${relsPath}: ${oldId}`);
      seenOldIds.add(oldId);
      const signature = `${type}\0${target}\0${targetMode}`;
      if (type.endsWith("/hyperlink") && canonicalHyperlinkIds.has(signature)) {
        idMap.set(oldId, canonicalHyperlinkIds.get(signature));
        redundant.push(match[0]);
        continue;
      }
      const ordinal = signatureOrdinals.get(signature) ?? 0;
      signatureOrdinals.set(signature, ordinal + 1);
      // Derive deterministic ID scoped to this .rels part
      const key = `${relsPath}\0${signature}\0${ordinal}`;
      const hash = createHash("sha256").update(key).digest("hex").substring(0, 16);
      const newId = `rId${hash}`;
      // Assert uniqueness within this part
      if (seenNewIds.has(newId)) {
        throw new Error(`deterministic ID collision in ${relsPath}: ${newId}`);
      }
      seenNewIds.add(newId);
      if (oldId !== newId) {
        idMap.set(oldId, newId);
      }
      if (type.endsWith("/hyperlink")) canonicalHyperlinkIds.set(signature, newId);
    }
    partMappings.set(relsPath, idMap);
    redundantHyperlinks.set(relsPath, redundant);
  }

  // Step 3: Replace IDs in each .rels file using only its own mapping
  for (const relsPath of relsFiles) {
    const idMap = partMappings.get(relsPath);
    const file = zip.file(relsPath);
    let content = await file.async("string");
    for (const redundant of redundantHyperlinks.get(relsPath)) {
      content = content.replace(redundant, "");
    }
    for (const [oldId, newId] of idMap) {
      content = content.replaceAll(`Id="${oldId}"`, `Id="${newId}"`);
    }
    zip.file(relsPath, content);
  }

  // Step 4: Replace ID references in XML files
  // Each XML file references IDs from its corresponding .rels file
  // Map: XML path -> owning .rels path
  const xmlToRels = new Map();
  for (const relsPath of relsFiles) {
    // word/_rels/document.xml.rels -> word/document.xml
    // _rels/.rels -> (root rels, applies to all root-level XMLs)
    const dir = relsPath.replace(/_rels\//, "").replace(/\.rels$/, "");
    xmlToRels.set(dir, relsPath);
  }

  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    if (path.endsWith(".rels")) continue;
    if (!path.endsWith(".xml")) continue;

    let content = await file.async("string");
    let changed = false;

    // Find which .rels file owns this XML. Core properties have no owning
    // relationship part but must still receive deterministic timestamps.
    const owningRels = xmlToRels.get(path);
    const idMap = owningRels ? partMappings.get(owningRels) : undefined;
    if (idMap && idMap.size > 0) {
      for (const [oldId, newId] of idMap) {
        const patterns = [
          `r:id="${oldId}"`,
          `r:embed="${oldId}"`,
          `r:link="${oldId}"`,
          `r:id='${oldId}'`,
          `r:embed='${oldId}'`,
          `r:link='${oldId}'`,
        ];
        for (const pattern of patterns) {
          const replacement = pattern.replace(oldId, newId);
          if (content.includes(pattern)) {
            content = content.replaceAll(pattern, replacement);
            changed = true;
          }
        }
      }
    }
    // Normalize timestamps in docProps/core.xml to a fixed value
    if (path === "docProps/core.xml") {
      const fixedTime = "2000-01-01T00:00:00.000Z";
      content = content.replace(
        /<dcterms:created[^>]*>[^<]*<\/dcterms:created>/,
        `<dcterms:created xsi:type="dcterms:W3CDTF">${fixedTime}</dcterms:created>`
      );
      content = content.replace(
        /<dcterms:modified[^>]*>[^<]*<\/dcterms:modified>/,
        `<dcterms:modified xsi:type="dcterms:W3CDTF">${fixedTime}</dcterms:modified>`
      );
      changed = true;
    }
    if (changed) {
      zip.file(path, content);
    }
  }

  // Step 5: Regenerate the ZIP buffer
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
