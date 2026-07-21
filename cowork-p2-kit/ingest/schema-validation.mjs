/** Small complete validator for the repository's JSON-Schema draft-07 contract. */

function typeMatches(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  return typeof value === type;
}

function display(path) {
  return path || "record";
}

/**
 * Validate all constraints represented by the committed records schema.
 * @param {unknown} value
 * @param {object} schema
 * @param {string} [path]
 * @returns {string[]}
 */
export function validateSchema(value, schema, path = "") {
  const errors = [];
  const types = schema.type === undefined ? [] : (Array.isArray(schema.type) ? schema.type : [schema.type]);
  if (types.length && !types.some((type) => typeMatches(value, type))) {
    return [`${display(path)} must be ${types.join(" or ")}`];
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${display(path)} must be one of ${schema.enum.join(", ")}`);
  if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${display(path)} must be >= ${schema.minimum}`);
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${display(path)} missing required field: ${key}`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (key in value) errors.push(...validateSchema(value[key], child, path ? `${path}.${key}` : key));
    }
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, index) => errors.push(...validateSchema(item, schema.items, `${path}[${index}]`)));
  }
  return errors;
}
