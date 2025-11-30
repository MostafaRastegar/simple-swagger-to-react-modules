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
 * @param {Map} sanitizedNameMap - Mapping of original names to sanitized names.
 * @returns {string} The TypeScript type.
 */
function mapSwaggerTypeToTs(
  schema,
  definitions = {},
  sanitizedNameMap = new Map()
) {
  if (schema.$ref) {
    const refName = schema.$ref.split("/").pop();
    // Check if we have a sanitized version of this name
    if (sanitizedNameMap && sanitizedNameMap.has(refName)) {
      return sanitizedNameMap.get(refName);
    }
    // Fixed: Return the interface name directly for $ref instead of recursively processing
    return refName;
  }
  if (schema.type === "array") {
    const itemsType = schema.items
      ? mapSwaggerTypeToTs(schema.items, definitions, sanitizedNameMap)
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
 * Sanitizes schema names to create valid TypeScript interface names
 * @param {string} name - The raw schema name from swagger
 * @returns {string} - A valid PascalCase interface name
 */
function sanitizeInterfaceName(name) {
  if (!name) return "Interface";

  // Replace spaces with underscores, remove special chars, and make PascalCase
  let cleaned = name
    .replace(/\s+/g, "_") // spaces to underscores
    .replace(/[^a-zA-Z0-9_]/g, "_") // special chars to underscores
    .replace(/^_+|_+$/g, "") // remove leading/trailing underscores
    .split("_") // split by underscore
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // PascalCase each word
    .join("");

  // Ensure it starts with a letter (TypeScript interface names can't start with numbers)
  if (/^[0-9]/.test(cleaned)) {
    cleaned = "Interface" + cleaned;
  }

  // Remove empty strings and ensure minimum length
  if (cleaned.length < 1) {
    cleaned = "Interface";
  }

  return cleaned;
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

/**
 * Centralized naming strategy for consistent naming across all generators.
 * Ensures TypeScript-valid identifiers and consistent conventions.
 */
class NamingStrategy {
  /**
   * Get base names for a module from raw module name
   * @param {string} rawModuleName - Raw module name from swagger/API (e.g., "activity-monitoring")
   * @returns {object} - { basePascalName, baseCamelName, fileName, rawName }
   */
  static getBaseNames(rawModuleName) {
    const basePascalName = sanitizeInterfaceName(rawModuleName);
    const baseCamelName =
      basePascalName.charAt(0).toLowerCase() + basePascalName.slice(1);
    const fileName = rawModuleName.toLowerCase();
    const rawName = rawModuleName;

    return { basePascalName, baseCamelName, fileName, rawName };
  }

  /**
   * Generate service class name
   * @param {string} basePascalName - PascalCase base name
   * @returns {string} - Service class name
   */
  static serviceName(basePascalName) {
    return `${basePascalName}Service`;
  }

  /**
   * Generate service interface name
   * @param {string} basePascalName - PascalCase base name
   * @returns {string} - Service interface name
   */
  static serviceInterfaceName(basePascalName) {
    return `I${basePascalName}Service`;
  }

  /**
   * Generate presentation function name
   * @param {string} basePascalName - PascalCase base name
   * @returns {string} - Presentation function name
   */
  static presentationName(basePascalName) {
    return `${basePascalName}Presentation`;
  }

  /**
   * Generate view function name
   * @param {string} basePascalName - PascalCase base name
   * @returns {string} - View function name
   */
  static viewName(basePascalName) {
    return `${basePascalName}View`;
  }

  /**
   * Generate store variable name
   * @param {string} baseCamelName - camelCase base name
   * @returns {string} - Store variable name
   */
  static storeName(baseCamelName) {
    return `${baseCamelName}Store`;
  }

  /**
   * Generate hook name
   * @param {string} basePascalName - PascalCase base name
   * @param {string} operation - Operation suffix (e.g., "List", "Create")
   * @returns {string} - Hook function name
   */
  static hookName(basePascalName, operation) {
    return `use${basePascalName}${operation}`;
  }

  /**
   * Generate model name
   * @param {string} basePascalName - PascalCase base name
   * @returns {string} - Model interface name
   */
  static modelName(basePascalName) {
    return basePascalName;
  }

  /**
   * Generate request DTO name
   * @param {string} basePascalName - PascalCase base name
   * @param {string} suffix - Optional suffix like "Create" or "Update"
   * @returns {string} - Request DTO name
   */
  static requestDtoName(basePascalName, suffix = "") {
    return `${basePascalName}${suffix}Request`;
  }

  /**
   * Generate create params DTO name
   * @param {string} basePascalName - PascalCase base name
   * @returns {string} - Create params DTO name
   */
  static createParamsName(basePascalName) {
    return `${basePascalName}CreateParams`;
  }

  /**
   * Generate endpoint object name (for constants)
   * @param {string} baseCamelName - camelCase base name
   * @returns {string} - Endpoint object name
   */
  static endpointsName(baseCamelName) {
    return `${baseCamelName}Endpoints`;
  }

  /**
   * Generate file path
   * @param {string} fileName - File name (kebab-case from raw name)
   * @param {string} extension - File extension
   * @returns {string} - File path relative to module directory
   */
  static filePath(fileName, extension) {
    return `${fileName}${extension}`;
  }

  /**
   * Generate directory path
   * @param {string} dirName - Directory name (kebab-case from raw name)
   * @returns {string} - Directory path
   */
  static directoryPath(dirName) {
    return `${dirName}/`;
  }

  /**
   * Find the main list hook name for a module by analyzing swagger operations
   * @param {string} basePascalName - PascalCase base name
   * @param {object} swaggerJson - Full swagger JSON
   * @param {string} rawModuleName - Raw module name to filter paths correctly
   * @returns {string} - Hook name like "useUserWalletlist"
   */
  static findMainListHook(basePascalName, swaggerJson, rawModuleName) {
    const paths = swaggerJson.paths || {};

    // Collect all potential list operations that belong to this module
    const listOperations = [];

    for (const [pathUrl, pathItem] of Object.entries(paths)) {
      if (pathItem.get) {
        const operation = pathItem.get;
        const parameters = operation.parameters || [];
        const operationId =
          operation.operationId ||
          `get_${pathUrl.replace(/\//g, "_").replace(/\{|\}/g, "")}`;

        // Only consider operations that belong to this module
        // Check if the path represents this module's resources
        const belongsToModule = this._pathBelongsToModule(
          pathUrl,
          rawModuleName
        );

        if (belongsToModule) {
          // Check if this looks like a list operation
          const isListOperation = this._isListOperation(
            operationId,
            parameters,
            pathUrl
          );

          if (isListOperation) {
            // Calculate the hook name using same logic as presentation generator
            const hookName = this._calculatePresentationHookName(
              basePascalName,
              operationId
            );
            listOperations.push({
              path: pathUrl,
              operationId,
              hookName,
              paramCount: parameters.length,
              hasPagination: this._hasPaginationParams(parameters),
            });
          }
        }
      }
    }

    // Select the best list operation
    if (listOperations.length > 0) {
      // Priority: 1) Has pagination params, 2) Fewer path params, 3) Shorter/simpler name
      listOperations.sort((a, b) => {
        if (a.hasPagination !== b.hasPagination)
          return b.hasPagination ? 1 : -1;
        if (a.paramCount !== b.paramCount) return a.paramCount - b.paramCount;
        return a.hookName.length - b.hookName.length;
      });

      return listOperations[0].hookName;
    }

    // Fallback: generate a generic list hook name
    return `use${basePascalName}List`;
  }

  /**
   * Check if a path belongs to a module
   * @private
   */
  static _pathBelongsToModule(pathUrl, moduleName) {
    const pathLower = pathUrl.toLowerCase();
    const moduleLower = moduleName.toLowerCase();

    // Path belongs to module if:
    // 1. It starts with /moduleName or /moduleName/
    // 2. Or contains /moduleName/ within the path
    return (
      pathLower.startsWith(`/${moduleLower}/`) ||
      pathLower.startsWith(`/${moduleLower}`) ||
      pathLower.includes(`/${moduleLower}/`)
    );
  }

  /**
   * Check if an operation looks like a list operation
   * @private
   */
  static _isListOperation(operationId, parameters, pathUrl) {
    const opId = operationId.toLowerCase();
    const path = pathUrl.toLowerCase();

    // Must be GET method (implicit from caller)
    const looksLikeList =
      opId.includes("list") ||
      opId.includes("getall") ||
      path.includes("/list") ||
      path.includes("/all");

    // Must not have path parameters (indicates it's not a specific item)
    const pathParams = parameters.filter((p) => p.in === "path");
    const hasPathParams = pathParams.length > 0;

    return looksLikeList && !hasPathParams;
  }

  /**
   * Check if operation has pagination parameters
   * @private
   */
  static _hasPaginationParams(parameters) {
    return parameters.some(
      (p) =>
        p.name &&
        (p.name.toLowerCase().includes("page") ||
          p.name.toLowerCase().includes("limit") ||
          p.name.toLowerCase().includes("offset") ||
          p.name.toLowerCase().includes("size") ||
          p.name === "params")
    );
  }

  /**
   * Calculate presentation hook name using same logic as presentation generator
   * @private
   */
  static _calculatePresentationHookName(basePascalName, operationId) {
    // Simulate the same logic as presentation generator
    let operationSuffix = operationId.replace(
      new RegExp(`${basePascalName.toLowerCase()}_?`),
      ""
    );
    operationSuffix = operationSuffix.replace(/^_+|_+$/g, ""); // Remove leading/trailing underscores

    // Process underscores like presentation generator does
    const parts = operationSuffix.split("_").filter((part) => part.length > 0); // Remove empty parts

    operationSuffix = parts
      .map((part, index) =>
        index === 0
          ? part
          : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      )
      .join("");

    // Sanitize like presentation generator
    operationSuffix = sanitizeInterfaceName(operationSuffix);

    return `use${basePascalName}${operationSuffix}`;
  }
}

module.exports = {
  formatCode,
  mapSwaggerTypeToTs,
  camelize,
  sanitizeInterfaceName,
  fileExists,
  ensureDirectoryExists,
  NamingStrategy,
};
