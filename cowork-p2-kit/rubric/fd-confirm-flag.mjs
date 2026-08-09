import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("./fd-confirm-flag.schema.v1.json", import.meta.url), "utf8"));

function fail(code, message) {
  const error = new Error(`[${code}] ${message}`);
  error.code = code;
  throw error;
}

function exactKeys(value, keys, code, context) {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    fail(code, `${context} keys must match the contract`);
  }
}

export function validateFdConfirmFlag(flag) {
  const code = "E_FD_CONFIRM_FLAG";
  exactKeys(flag, ["schema_version", "flag_state", "confirmed_by", "confirmed_at", "note"], code, "fd-confirm flag");
  if (flag.schema_version !== schema.properties.schema_version.const) fail(code, "fd-confirm flag schema version is invalid");
  if (flag.flag_state !== "unset" && flag.flag_state !== "confirmed") fail(code, "fd-confirm flag state is invalid");
  const confirmed = flag.flag_state === "confirmed";
  for (const field of ["confirmed_by", "confirmed_at", "note"]) {
    if (confirmed ? typeof flag[field] !== "string" || flag[field].trim() === "" : flag[field] !== null) {
      fail(code, `fd-confirm flag ${field} is inconsistent with ${flag.flag_state}`);
    }
  }
  if (confirmed && Number.isNaN(Date.parse(flag.confirmed_at))) fail(code, "fd-confirm flag confirmed_at must be an ISO date");
  return flag;
}

export function createFdConfirmFlag(overrides = {}) {
  return validateFdConfirmFlag({
    schema_version: "fd-confirm-flag/v1",
    flag_state: "unset",
    confirmed_by: null,
    confirmed_at: null,
    note: null,
    ...overrides,
  });
}

export function isFdConfirmed(flag) {
  return validateFdConfirmFlag(flag).flag_state === "confirmed";
}
