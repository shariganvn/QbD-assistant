// What a data gap looks like, shared by the Stage B validator, the Stage C renderer and the tests.
// It lives here, in schemas/, for the same reason TABLE_WIDTH_DXA does (see layout.mjs): neither
// side owns it. The renderer writes the marker, the gap register and the validator read it back,
// and the import is what keeps the three in agreement — not a comment asking them to match.
//
// A missing value must SAY it is missing. A blank cell reads as "not applicable" to someone
// skimming a document shaped like a registration dossier, which is the opposite of the truth.

// Printed at the head of a gap paragraph, and quoted to the reader in the scope notice.
export const GAP_LABEL = "[CHƯA CÓ DỮ LIỆU – CẦN BỔ SUNG]";

// What a cell must start with, or contain, to count as marked. Shorter than GAP_LABEL because a
// table cell may carry a trailing note ("...] cần lấy từ hồ sơ lô") or abbreviate the label, and
// both are still gaps.
export const GAP_PREFIX = "[CHƯA CÓ DỮ LIỆU";

export function isGapText(text) {
  return typeof text === "string" && text.includes(GAP_PREFIX);
}
