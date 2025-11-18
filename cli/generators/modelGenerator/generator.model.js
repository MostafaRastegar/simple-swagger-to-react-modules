const fs = require("fs").promises;
const path = require("path");
const { formatCode, camelize } = require("../../utils");
const { generateSingleModelInterface } = require("./interface.model");

/**
 * Generates model files for a given module.
 * @param {string} modelsDir - The directory to save model files.
 * @param {string} moduleName - The name of the module.
 * @param {object} swaggerJson - The complete Swagger JSON object.
 */
async function generateModelFiles(modelsDir, moduleName, swaggerJson) {
  const definitions =
    swaggerJson.definitions || swaggerJson.components?.schemas || {};
  const mainModelName =
    moduleName.charAt(0).toUpperCase() + moduleName.slice(1);

  let mainModelDefinition = definitions[mainModelName];

  // If main definition not found, try common singular forms
  if (!mainModelDefinition) {
    const singularForms = [
      mainModelName.slice(0, -1), // e.g., Categories -> Categorie
      mainModelName.replace(/s$/, ""), // e.g., Categories -> Category
      mainModelName.replace(/ies$/, "y"), // e.g., Categories -> Category
    ];
    for (const form of singularForms) {
      if (definitions[form]) {
        mainModelDefinition = definitions[form];
        break;
      }
    }
  }

  let allModelContent = "";
  const processedSchemaNames = new Set(); // To keep track of already processed schemas

  // Helper to generate a schema interface and add its content
  const addSchemaInterface = async (schemaName, definition) => {
    if (!processedSchemaNames.has(schemaName) && definition) {
      console.log(
        `[DEBUG] addSchemaInterface called for: ${schemaName}`,
        definition
      );
      const generatedInterface = await generateSingleModelInterface(
        schemaName,
        definition,
        definitions
      );
      console.log(
        `[DEBUG] Generated interface for ${schemaName}:\n${generatedInterface}`
      );
      allModelContent += generatedInterface;
      processedSchemaNames.add(schemaName);
      console.log(`[DEBUG] ${schemaName} added to processedSchemaNames.`);
    } else {
      console.log(
        `[DEBUG] addSchemaInterface SKIPPED for ${schemaName}. Processed: ${processedSchemaNames.has(schemaName)}, Definition: ${!!definition}`
      );
    }
  };

  // Generate and add the main model interface
  if (mainModelDefinition) {
    await addSchemaInterface(mainModelName, mainModelDefinition);
  } else {
    console.warn(
      `Warning: Main definition for '${moduleName}' not found in swagger.json. Generating model file with basic structure.`
    );
    allModelContent += `export interface ${mainModelName} {\n  // Placeholder: No main definition found\n}\n\n`;
    processedSchemaNames.add(mainModelName); // Mark as processed
  }

  // Find and add related definitions used by the main model
  if (mainModelDefinition && mainModelDefinition.properties) {
    for (const propSchema of Object.values(mainModelDefinition.properties)) {
      if (propSchema.$ref) {
        const refName = propSchema.$ref.split("/").pop();
        if (refName && refName !== mainModelName) {
          const relatedDef = definitions[refName];
          await addSchemaInterface(refName, relatedDef);
        }
      }
      if (
        propSchema.type === "array" &&
        propSchema.items &&
        propSchema.items.$ref
      ) {
        const refName = propSchema.items.$ref.split("/").pop();
        if (refName && refName !== mainModelName) {
          const relatedDef = definitions[refName];
          await addSchemaInterface(refName, relatedDef);
        }
      }
    }
  }

  // NEW: Collect and add schemas used in request bodies and responses for this module's paths
  const paths = swaggerJson.paths || {};
  const basePath = swaggerJson.basePath || "";

  for (const [pathUrl, pathItem] of Object.entries(paths)) {
    console.log(`[DEBUG] Checking path: ${pathUrl}`);
    const effectivePath = pathUrl.startsWith("/")
      ? pathUrl.substring(1)
      : pathUrl;
    const pathSegments = effectivePath.split("/");
    const relevantSegmentIndex = basePath
      ? pathSegments.findIndex((seg) => seg === moduleName.split("/")[0])
      : pathSegments.findIndex((seg) => seg === moduleName);

    if (relevantSegmentIndex !== -1) {
      console.log(
        `[DEBUG] Path ${pathUrl} relevant for module ${moduleName}. Segment index: ${relevantSegmentIndex}`
      );
      for (const [method, operation] of Object.entries(pathItem)) {
        if (["get", "post", "put", "delete"].includes(method)) {
          console.log(
            `[DEBUG] Processing operation: ${method} ${operation.operationId || "NoOpId"}`
          );
          // Process request body
          if (operation.requestBody && operation.requestBody.content) {
            for (const mediaType of Object.values(
              operation.requestBody.content
            )) {
              if (mediaType.schema) {
                const schemaName = mediaType.schema.$ref
                  ? mediaType.schema.$ref.split("/").pop()
                  : `${mainModelName}_${camelize(operation.operationId || method)}_Body`; // Fallback for inline schemas
                console.log(`[DEBUG] Found request body schema: ${schemaName}`);
                if (schemaName && definitions[schemaName]) {
                  console.log(
                    `[DEBUG] Adding request body schema interface: ${schemaName}`
                  );
                  await addSchemaInterface(schemaName, definitions[schemaName]);
                }
              }
            }
          }

          // Process responses
          for (const [responseKey, responseObj] of Object.entries(
            operation.responses || {}
          )) {
            // Check for schema in content (OpenAPI 3.0 style)
            if (
              responseObj.content &&
              responseObj.content["application/json"]
            ) {
              const schema = responseObj.content["application/json"].schema;
              if (schema) {
                const schemaName = schema.$ref
                  ? schema.$ref.split("/").pop()
                  : `${mainModelName}_${camelize(operation.operationId || method)}_${responseKey}_Response`; // Fallback for inline schemas
                console.log(
                  `[DEBUG] Found response schema for ${responseKey} (from content): ${schemaName}`
                );
                if (schemaName && definitions[schemaName]) {
                  console.log(
                    `[DEBUG] Adding response schema interface: ${schemaName}`
                  );
                  await addSchemaInterface(schemaName, definitions[schemaName]);
                }
                // Handle array responses
                if (
                  schema.type === "array" &&
                  schema.items &&
                  schema.items.$ref
                ) {
                  const arrayItemSchemaName = schema.items.$ref
                    .split("/")
                    .pop();
                  console.log(
                    `[DEBUG] Found array item schema for ${responseKey}: ${arrayItemSchemaName}`
                  );
                  if (arrayItemSchemaName && definitions[arrayItemSchemaName]) {
                    console.log(
                      `[DEBUG] Adding array item schema interface: ${arrayItemSchemaName}`
                    );
                    await addSchemaInterface(
                      arrayItemSchemaName,
                      definitions[arrayItemSchemaName]
                    );
                  }
                }
              }
            }
            // Fallback for direct schema (less common in OpenAPI 3.0, but good for compatibility)
            else if (responseObj.schema) {
              const schemaName = responseObj.schema.$ref
                ? responseObj.schema.$ref.split("/").pop()
                : `${mainModelName}_${camelize(operation.operationId || method)}_${responseKey}_Response`;
              console.log(
                `[DEBUG] Found response schema for ${responseKey} (direct): ${schemaName}`
              );
              if (schemaName && definitions[schemaName]) {
                console.log(
                  `[DEBUG] Adding response schema interface: ${schemaName}`
                );
                await addSchemaInterface(schemaName, definitions[schemaName]);
              }
            }
          }
        }
      }
    } else {
      console.log(
        `[DEBUG] Path ${pathUrl} NOT relevant for module ${moduleName}. Segment index: ${relevantSegmentIndex}`
      );
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
  const definitions =
    swaggerJson.definitions || swaggerJson.components?.schemas || {};
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

module.exports = {
  generateModelFiles,
  generateFormDataInterfaces,
};
