const fs = require("fs").promises;
const path = require("path");
const { formatCode, mapSwaggerTypeToTs } = require("../utils");

/**
 * Generates model files for a given module.
 * @param {string} modelsDir - The directory to save model files.
 * @param {string} moduleName - The name of the module.
 * @param {object} definitions - Swagger definitions.
 */
async function generateModelFiles(modelsDir, moduleName, definitions) {
  const mainModelName =
    moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
  const mainModelDefinition = definitions[mainModelName];

  let allModelContent = "";

  if (mainModelDefinition) {
    allModelContent += await generateSingleModelInterface(
      mainModelName,
      mainModelDefinition,
      definitions
    );
  } else {
    console.warn(
      `Warning: Main definition for '${moduleName}' not found in swagger.json. Generating model file with basic structure.`
    );
    allModelContent += `export interface ${mainModelName} {\n  // Placeholder: No main definition found\n}\n\n`;
  }

  // Find and add related definitions used by the main model
  if (mainModelDefinition && mainModelDefinition.properties) {
    for (const propSchema of Object.values(mainModelDefinition.properties)) {
      if (propSchema.$ref) {
        const refName = propSchema.$ref.split("/").pop();
        if (
          refName &&
          refName !== mainModelName &&
          !allModelContent.includes(`export interface ${refName}`)
        ) {
          const relatedDef = definitions[refName];
          if (relatedDef) {
            allModelContent += await generateSingleModelInterface(
              refName,
              relatedDef,
              definitions
            );
          }
        }
      }
      if (
        propSchema.type === "array" &&
        propSchema.items &&
        propSchema.items.$ref
      ) {
        const refName = propSchema.items.$ref.split("/").pop();
        if (
          refName &&
          refName !== mainModelName &&
          !allModelContent.includes(`export interface ${refName}`)
        ) {
          const relatedDef = definitions[refName];
          if (relatedDef) {
            allModelContent += await generateSingleModelInterface(
              refName,
              relatedDef,
              definitions
            );
          }
        }
      }
    }
  }

  // Add DTOs for the main module
  const requestDtoName = `${mainModelName}CreateParams`;
  const responseDtoName = `${mainModelName}Response`;
  allModelContent += `// Common request/response DTOs for ${moduleName}\n`;
  allModelContent += `export interface ${requestDtoName} extends Omit<${mainModelName}, 'id'> {}\n`; // Omit ID for creation
  allModelContent += `export interface ${responseDtoName} {\n  data: ${mainModelName};\n  message?: string;\n  code?: number;\n}\n`;

  const finalContent = await formatCode(allModelContent);
  await fs.writeFile(
    path.join(modelsDir, `${mainModelName}.ts`), // Changed to capitalized
    finalContent
  );
}

/**
 * Generates a single model interface.
 * @param {string} interfaceName - The name of the interface.
 * @param {object} modelDefinition - The model definition from Swagger.
 * @param {object} definitions - Swagger definitions.
 * @returns {string} The TypeScript interface string.
 */
async function generateSingleModelInterface(
  interfaceName,
  modelDefinition,
  definitions
) {
  let propertiesTs = "";
  if (modelDefinition.properties) {
    for (const [propName, propSchema] of Object.entries(
      modelDefinition.properties
    )) {
      const isOptional = !modelDefinition.required?.includes(propName);
      let typeName = mapSwaggerTypeToTs(propSchema, definitions);

      if (propSchema.type === "array") {
        const arrayItemType = propSchema.items
          ? mapSwaggerTypeToTs(propSchema.items, definitions)
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
  generateModelFiles,
  generateSingleModelInterface,
};
