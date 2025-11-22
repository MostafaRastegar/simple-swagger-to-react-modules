const fs = require("fs").promises;
const path = require("path");
const { mapSwaggerTypeToTs } = require("../../utils");

/**
 * Generates a single model interface.
 * @param {string} interfaceName - The name of the interface.
 * @param {object} modelDefinition - The model definition from Swagger.
 * @param {object} definitions - Swagger definitions.
 * @param {Map} sanitizedNameMap - Mapping of original names to sanitized names.
 * @returns {string} The TypeScript interface string.
 */
async function generateSingleModelInterface(
  interfaceName,
  modelDefinition,
  definitions,
  sanitizedNameMap = new Map()
) {
  let propertiesTs = "";
  if (modelDefinition.properties) {
    for (const [propName, propSchema] of Object.entries(
      modelDefinition.properties
    )) {
      const isOptional = !modelDefinition.required?.includes(propName);
      let typeName = mapSwaggerTypeToTs(
        propSchema,
        definitions,
        sanitizedNameMap,
        sanitizedNameMap
      );

      if (propSchema.type === "array") {
        const arrayItemType = propSchema.items
          ? mapSwaggerTypeToTs(
              propSchema.items,
              definitions,
              sanitizedNameMap,
              sanitizedNameMap
            )
          : "any";
        typeName = `Array<${arrayItemType}>`;
      }

      propertiesTs += `  ${propName}${isOptional ? "?" : ""}: ${typeName};\n`;
    }
  } else {
    propertiesTs = `  // No properties defined for ${interfaceName}\n`;
  }
  return `export interface ${interfaceName} {\n${propertiesTs}}\n\n`;
}

module.exports = {
  generateSingleModelInterface,
};
