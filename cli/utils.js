const prettier = require("prettier");

/**
 * Formats code using Prettier.
 * @param {string} code - The code to format.
 * @param {string} parser - The parser to use (default: 'typescript').
 * @returns {string} The formatted code.
 */
async function formatCode(code, parser = "typescript") {
  try {
    return prettier.format(code, {
      parser,
      semi: true,
      singleQuote: true,
      tabWidth: 2,
    });
  } catch (error) {
    console.error("Prettier formatting error:", error);
    return code;
  }
}

/**
 * Maps Swagger schema types to TypeScript types.
 * @param {object} schema - The Swagger schema object.
 * @param {object} definitions - Swagger definitions.
 * @returns {string} The TypeScript type.
 */
function mapSwaggerTypeToTs(schema, definitions = {}) {
  if (schema.$ref) {
    const refName = schema.$ref.split("/").pop();
    // Fixed: Return the interface name directly for $ref instead of recursively processing
    return refName;
  }
  if (schema.type === "array") {
    const itemsType = schema.items
      ? mapSwaggerTypeToTs(schema.items, definitions)
      : "any";
    return `Array<${itemsType}>`;
  }
  if (schema.type === "integer" && schema.format === "int64") return "number";
  if (schema.type === "integer") return "number";
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "string") {
    if (schema.enum) return schema.enum.map((e) => `'${e}'`).join(" | ");
    return "string";
  }
  if (schema.type === "object") {
    if (schema.properties) {
      return "Record<string, any>"; // Simplified for inline objects
    }
    return "object";
  }
  return "any";
}

/**
 * Converts a string from snake_case or kebab-case to camelCase.
 * @param {string} str - The string to convert.
 * @returns {string} The camelCase string.
 */
function camelize(str) {
  return str.replace(/([-_][a-z])/g, (group) =>
    group.toUpperCase().replace("-", "").replace("_", "")
  );
}

/**
 * Checks if a file exists at the given path.
 * @param {string} filePath - The path to the file.
 * @returns {Promise<boolean>} True if the file exists, false otherwise.
 */
async function fileExists(filePath) {
  try {
    const fs = require("fs").promises;
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Creates a directory recursively if it doesn't exist.
 * @param {string} dirPath - The path of the directory to create.
 */
async function ensureDirectoryExists(dirPath) {
  const fs = require("fs").promises;
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (mkdirErr) {
    if (mkdirErr.code !== "EEXIST") {
      throw mkdirErr;
    }
  }
}

module.exports = {
  formatCode,
  mapSwaggerTypeToTs,
  camelize,
  fileExists,
  ensureDirectoryExists,
};
