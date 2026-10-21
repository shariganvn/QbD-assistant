// The shared vocabulary for one rule: a document used as a FORMAT reference must not become a source
// of DATA. The repo now holds a finished P.2 for the same product, made by a different company with a
// different formula, and every value in it is a value nobody here measured. Names and numbers are
// therefore hashed on the way in and compared as hashes, so the blocklist itself never becomes a copy
// of the other company's data.
//
// Normalisation matters as much as the hash. A value retyped with the other decimal separator is the
// same value, so "98,64" and "98.64" must hash alike — otherwise swapping a comma for a dot is a way
// past the rule, and that is precisely the kind of near-copy this exists to catch.

import { createHash } from "node:crypto";

export const HASH_ALGORITHM = "sha256/16";

export function normalizeToken(raw) {
  const trimmed = String(raw).trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  if (!trimmed) return "";
  // A decimal comma and a decimal point mean the same measurement. Only touch separators that sit
  // between digits, so a thousands comma in "20,000" is normalised the same way and a sentence comma
  // is left alone.
  return trimmed.toLowerCase().replace(/(\d)[.,](\d)/g, "$1.$2");
}

export function hashToken(raw) {
  const normalized = normalizeToken(raw);
  if (!normalized) return "";
  return createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 16);
}

// A token is a word, a number, or an identifier that may carry a slash or a dot inside it — batch
// numbers written with a slash and values written with a decimal point both have to survive
// tokenisation whole.
const TOKEN_PATTERN = /[\p{L}\p{N}][\p{L}\p{N}/.,-]*/gu;

export function tokensOf(text) {
  return String(text ?? "").match(TOKEN_PATTERN) ?? [];
}

// Values that look measured: a decimal with at least two places. One such value shared with the
// reference document is a coincidence; three from the same table of it is a copied block, which is
// exactly how the first copied results table in this project was found.
export const MEASURED_VALUE_PATTERN = /^\d{1,6}[.,]\d{2,}$/;

export function measuredValuesOf(text) {
  return tokensOf(text).filter((token) => MEASURED_VALUE_PATTERN.test(token));
}
