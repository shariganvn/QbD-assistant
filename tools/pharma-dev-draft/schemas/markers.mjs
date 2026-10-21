// What an unfinished spot looks like, shared by the Stage B validator, the Stage C renderer and the
// tests. It lives here, in schemas/, for the same reason TABLE_WIDTH_DXA does (see layout.mjs):
// neither side owns it. The renderer writes the marker, the registers and the validator read it back,
// and the import is what keeps the three in agreement — not a comment asking them to match.
//
// A missing value must SAY it is missing. A blank cell reads as "not applicable" to someone
// skimming a document shaped like a registration dossier, which is the opposite of the truth.
//
// There are two kinds, because a document is held up by two different things and they go to two
// different people. A GAP is an absence: nobody has measured this yet, and it is closed by producing
// data. A DECISION is a disagreement or an unapproved assumption: the data exists, or the statement
// is already written, and it is closed by somebody with the authority to choose. Collapsing them
// would let the document report only the first kind, which is how it came to list a hundred data
// requests and no decisions while carrying both.

// Printed at the head of a gap paragraph, and quoted to the reader in the scope notice.
export const GAP_LABEL = "[CHƯA CÓ DỮ LIỆU – CẦN BỔ SUNG]";

// What a cell must start with, or contain, to count as marked. Shorter than GAP_LABEL because a
// table cell may carry a trailing note ("...] cần lấy từ hồ sơ lô") or abbreviate the label, and
// both are still gaps.
export const GAP_PREFIX = "[CHƯA CÓ DỮ LIỆU";

export const DECISION_LABEL = "[CẦN QUYẾT ĐỊNH – CHƯA CHỐT]";

export const DECISION_PREFIX = "[CẦN QUYẾT ĐỊNH";

export function isGapText(text) {
  return typeof text === "string" && text.includes(GAP_PREFIX);
}

export function isDecisionText(text) {
  return typeof text === "string" && text.includes(DECISION_PREFIX);
}

// Either kind. Used where the question is "has this spot been settled", not "which way is it open":
// the gap register asks exactly that, and answering it with isGapText alone reported a section whose
// only content was an open decision as one that holds data.
export function isMarkedText(text) {
  return isGapText(text) || isDecisionText(text);
}

// What is left of a marked cell once the label is taken off: the request, or the decision. Both
// registers read their rows out of this, so it lives beside the labels rather than in either of them.
// Tries the longest form first, since GAP_LABEL starts with GAP_PREFIX.
const MARKER_LABELS = [GAP_LABEL, DECISION_LABEL, `${GAP_PREFIX}]`, `${DECISION_PREFIX}]`, GAP_PREFIX, DECISION_PREFIX];

export function markerText(text) {
  const trimmed = String(text).trim();
  for (const label of MARKER_LABELS) {
    if (trimmed.startsWith(label)) return trimmed.slice(label.length).replace(/^[\s\]]+/, "").trim();
  }
  for (const prefix of [GAP_PREFIX, DECISION_PREFIX]) {
    const index = trimmed.indexOf(prefix);
    if (index !== -1) return trimmed.slice(index + prefix.length).replace(/^[\s\]]+/, "").trim();
  }
  return trimmed;
}
