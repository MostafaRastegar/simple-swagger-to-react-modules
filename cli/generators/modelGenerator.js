const fs = require("fs").promises;
const path = require("path");
const { formatCode, mapSwaggerTypeToTs, camelize } = require("../utils");

/**
 * Generates model files for a given module.
 * @param {string} modelsDir - The directory to save model files.
 * @param {string} moduleName - The name of the module.
 * @param {object} swaggerJson - The complete Swagger JSON object.
 */
async function generateModelFiles(modelsDir, moduleName, swaggerJson) {
  const definitions = swaggerJson.definitions || {};
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

  // Generate FormData interfaces for operations with formData parameters
  allModelContent += await generateFormDataInterfaces(
    moduleName,
    mainModelName,
    swaggerJson
  );

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
 * Generates FormData interfaces for operations with formData parameters.
 * @param {string} moduleName - The name of the module.
 * @param {string} mainModelName - The capitalized model name.
 * @param {object} swaggerJson - The complete Swagger JSON object.
 * @returns {string} The FormData interface TypeScript code.
 */
async function generateFormDataInterfaces(
  moduleName,
  mainModelName,
  swaggerJson
) {
  const definitions = swaggerJson.definitions || {};
  const paths = swaggerJson.paths || {};
  const basePath = swaggerJson.basePath || "";
  let formDataInterfaces = "";

  for (const [pathUrl, pathItem] of Object.entries(paths)) {
    const effectivePath = pathUrl.startsWith("/")
      ? pathUrl.substring(1)
      : pathUrl;
    const pathSegments = effectivePath.split("/");
    const relevantSegmentIndex = basePath
      ? pathSegments.findIndex((seg) => seg === moduleName.split("/")[0])
      : pathSegments.findIndex((seg) => seg === moduleName);

    if (relevantSegmentIndex !== -1) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (["post", "put"].includes(method)) {
          const formDataParams =
            operation.parameters?.filter((p) => p.in === "formData") || [];

          if (formDataParams.length > 0) {
            const operationId =
              operation.operationId ||
              `${method}_${pathUrl.replace(/\//g, "_").replace(/\{|\}/g, "")}`;
            const interfaceName = `${mainModelName}${camelize(operationId.replace(new RegExp(moduleName, "i"), ""))}FormData`;

            let interfaceProps = "";
            for (const param of formDataParams) {
              const paramType = mapSwaggerTypeToTs(param, definitions);
              const isOptional = !param.required;
              interfaceProps += `  ${param.name}${isOptional ? "?" : ""}: ${paramType};\n`;
            }

            formDataInterfaces += `export interface ${interfaceName} {\n${interfaceProps}}\n\n`;
          }
        }
      }
    }
  }

  return formDataInterfaces;
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
