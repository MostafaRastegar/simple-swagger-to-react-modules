const fs = require("fs").promises;
const path = require("path");
const {
  formatCode,
  mapSwaggerTypeToTs,
  camelize,
  sanitizeInterfaceName,
} = require("../../utils");

/**
 * Generates the service interface file.
 * @param {string} domainsDir - The directory for domain files.
 * @param {string} moduleName - The name of the module.
 * @param {object} swaggerJson - The parsed Swagger JSON.
 * @param {string} baseUrl - The base API URL.
 */
async function generateServiceInterface(
  domainsDir,
  moduleName,
  swaggerJson,
  baseUrl
) {
  const modelName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
  // Sanitize the model name for TypeScript identifiers
  const sanitizedModelName = sanitizeInterfaceName(modelName);
  const interfaceName = `I${sanitizedModelName}Service`;
  const requestDtoName = `${sanitizedModelName}CreateParams`;
  const responseTypeName = "ResponseObject";

  let methodsTs = "";
  const paths = swaggerJson.paths || {};
  const basePath = swaggerJson.basePath || "";
  const mainModelName = sanitizedModelName;

  // Keep original module name for path matching
  const originalModelName = modelName;
  const definitions =
    swaggerJson.definitions || swaggerJson.components?.schemas || {};

  // Import types for list methods
  const importedListTypes = new Set();

  // Collect FormData interface names for import
  const formDataInterfaceNames = new Set();
  // Collect response schema types for import
  const responseSchemaTypes = new Set();
  // Collect model types used in params for import
  const paramModelTypes = new Set();

  for (const [pathUrl, pathItem] of Object.entries(paths)) {
    const effectivePath = pathUrl.startsWith("/")
      ? pathUrl.substring(1)
      : pathUrl;
    const pathSegments = effectivePath.split("/");
    const relevantSegmentIndex = basePath
      ? pathSegments.findIndex(
          (seg) => seg === originalModelName.toLowerCase().split("/")[0]
        )
      : pathSegments.findIndex(
          (seg) => seg === originalModelName.toLowerCase()
        );

    if (relevantSegmentIndex !== -1) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (["get", "post", "put", "delete"].includes(method)) {
          const operationId =
            operation.operationId ||
            `${method}_${pathUrl.replace(/\//g, "_").replace(/\{|\}/g, "")}`;

          let methodName = camelize(
            operationId.replace(
              new RegExp(originalModelName.toLowerCase(), "i"),
              ""
            )
          );

          // Convert PascalCase to camelCase for method names
          // Handle sub-module operations like "help_List" -> "helpList"
          if (methodName.includes("_")) {
            // For sub-module operations like "_help_list" -> "helpList"
            const parts = methodName.split("_");
            methodName =
              parts[0].toLowerCase() +
              parts[1].charAt(0).toUpperCase() +
              parts[1].slice(1);
          } else {
            // For main operations like "List" -> "list"
            methodName =
              methodName.charAt(0).toLowerCase() + methodName.slice(1);
          }

          let paramsTs = "";
          const allParams = operation.parameters || [];
          const pathParams = allParams.filter((p) => p.in === "path");
          const queryParams = allParams.filter((p) => p.in === "query");
          const bodyParam =
            operation.requestBody?.content?.["application/json"]?.schema;
          const formDataParams = allParams.filter((p) => p.in === "formData");

          // Check if the method is a list method
          const isListMethod = methodName.toLowerCase().includes("list");

          // Check if there's only one path parameter named 'id' and no query parameters, body, or formData
          if (
            !isListMethod &&
            pathParams.length === 1 &&
            pathParams[0].name === "id" &&
            queryParams.length === 0 &&
            !bodyParam &&
            formDataParams.length === 0
          ) {
            const paramType = mapSwaggerTypeToTs(pathParams[0], definitions);
            paramsTs = `id: ${paramType}`;
          } else {
            // Handle path and query parameters
            for (const param of allParams) {
              if (param.in === "path" || param.in === "query") {
                const paramType = mapSwaggerTypeToTs(param, definitions);
                const isOptional = !param.required;
                paramsTs += `${param.name}${isOptional ? "?" : ""}: ${paramType}, `;
              }
            }

            // Handle formData as single body object with correct interface name
            if (formDataParams.length > 0) {
              // Use same naming logic as modelGenerator
              const formDataInterface = `${mainModelName}${camelize(operationId.replace(new RegExp(originalModelName.toLowerCase(), "i"), ""))}FormData`;
              formDataInterfaceNames.add(formDataInterface);
              paramsTs += `body: ${formDataInterface}, `;
            }

            // Handle body parameter
            if (bodyParam) {
              const bodyType = bodyParam.$ref
                ? bodyParam.$ref.split("/").pop()
                : mapSwaggerTypeToTs(bodyParam, definitions);
              if (definitions[bodyType]) {
                // If it's a list method, use PaginationParams
                if (isListMethod) {
                  paramsTs = `params: PaginationParams`;
                } else {
                  // For non-list methods with body, combine path/query params with body
                  const pathQueryParams = [];
                  for (const param of allParams) {
                    if (param.in === "path" || param.in === "query") {
                      const paramType = mapSwaggerTypeToTs(param, definitions);
                      const isOptional = !param.required;
                      pathQueryParams.push(
                        `${param.name}${isOptional ? "?" : ""}: ${paramType}`
                      );
                    }
                  }
                  if (pathQueryParams.length > 0) {
                    paramsTs = `${pathQueryParams.join(", ")}, body: ${bodyType}`;
                  } else {
                    // For methods with only body (like Create), use the body type directly
                    paramsTs = `${bodyType}`;
                  }
                }
                // Add bodyType to responseSchemaTypes to ensure it's imported
                responseSchemaTypes.add(bodyType);
              } else {
                if (isListMethod) {
                  paramsTs = `params: PaginationParams`;
                } else {
                  // For non-list methods with body, combine path/query params with body
                  const pathQueryParams = [];
                  for (const param of allParams) {
                    if (param.in === "path" || param.in === "query") {
                      const paramType = mapSwaggerTypeToTs(param, definitions);
                      const isOptional = !param.required;
                      pathQueryParams.push(
                        `${param.name}${isOptional ? "?" : ""}: ${paramType}`
                      );
                    }
                  }
                  if (pathQueryParams.length > 0) {
                    paramsTs = `${pathQueryParams.join(", ")}, body: ${requestDtoName}`;
                  } else {
                    // For methods with only body (like Create), use the requestDtoName directly
                    paramsTs = `${requestDtoName}`;
                  }
                }
              }
            } else if (paramsTs) {
              // Handle cases with only path/query params
              const allParamsObj = {};
              for (const param of allParams) {
                if (param.in === "path" || param.in === "query") {
                  const paramType = mapSwaggerTypeToTs(param, definitions);
                  const isOptional = !param.required;
                  allParamsObj[param.name] = isOptional
                    ? `${paramType} | undefined`
                    : paramType;
                }
              }
              paramsTs = `params: { ${Object.entries(allParamsObj)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ")} }`;
            }
          }

          if (paramsTs.endsWith(", ")) {
            paramsTs = paramsTs.slice(0, -2);
          }

          if (isListMethod) {
            // For list methods, use PaginationParams and PaginationList
            const successStatusCode = Object.keys(operation.responses).find(
              (code) => code.startsWith("2")
            );
            const successResponse =
              successStatusCode &&
              operation.responses[successStatusCode]?.content?.[
                "application/json"
              ]?.schema;
            let listItemType = "any"; // Default to any
            if (successResponse) {
              if (successResponse.type === "array" && successResponse.items) {
                listItemType = successResponse.items.$ref
                  ? successResponse.items.$ref.split("/").pop()
                  : mapSwaggerTypeToTs(successResponse.items, definitions);
                importedListTypes.add(listItemType);
              } else if (successResponse.$ref) {
                const refType = successResponse.$ref.split("/").pop();
                if (
                  definitions[refType] &&
                  definitions[refType].type === "object" &&
                  definitions[refType].properties?.results
                ) {
                  const resultsType = definitions[refType].properties.results;
                  if (resultsType.type === "array" && resultsType.items) {
                    listItemType = resultsType.items.$ref
                      ? resultsType.items.$ref.split("/").pop()
                      : mapSwaggerTypeToTs(resultsType.items, definitions);
                    importedListTypes.add(listItemType);
                  }
                }
              }
            }
            methodsTs += `  ${methodName}(params: PaginationParams): Promise<ResponseObject<PaginationList<${listItemType}>>>;\n`;
          } else {
            // Generate proper return type based on response schema
            let returnType = `Promise<${responseTypeName}<${mainModelName}>>`;
            const successStatusCode = Object.keys(operation.responses).find(
              (code) => code.startsWith("2")
            );
            const successResponse =
              successStatusCode &&
              operation.responses[successStatusCode]?.content?.[
                "application/json"
              ]?.schema;

            if (successResponse) {
              // For array responses
              if (successResponse.type === "array" && successResponse.items) {
                const itemType = successResponse.items.$ref
                  ? successResponse.items.$ref.split("/").pop()
                  : mapSwaggerTypeToTs(successResponse.items, definitions);
                responseSchemaTypes.add(itemType);
                returnType = `Promise<${responseTypeName}<Array<${itemType}>>>`;
              }
              // For single object responses
              else if (successResponse.$ref) {
                const refType = successResponse.$ref.split("/").pop();
                responseSchemaTypes.add(refType);
                returnType = `Promise<${responseTypeName}<${refType}>>`;
              }
              // For other types
              else {
                const resolvedType = mapSwaggerTypeToTs(
                  successResponse,
                  definitions
                );
                if (definitions[resolvedType]) {
                  responseSchemaTypes.add(resolvedType);
                  returnType = `Promise<${responseTypeName}<${resolvedType}>>`;
                }
              }
            }

            // Handle different parameter patterns
            if (!paramsTs || paramsTs.trim() === "") {
              // No parameters
              methodsTs += `  ${methodName}(): ${returnType};\n`;
            } else if (paramsTs.startsWith("params: ")) {
              const cleanParams = paramsTs.replace("params: ", "");
              if (cleanParams.trim() === "") {
                methodsTs += `  ${methodName}(): ${returnType};\n`;
              } else {
                methodsTs += `  ${methodName}(${paramsTs}): ${returnType};\n`;
              }
            } else if (paramsTs.includes(", ") && paramsTs.includes("body:")) {
              // Combined parameters like "id: any, body: CategoryRequest"
              const paramsArray = paramsTs.split(", ");
              methodsTs += `  ${methodName}(${paramsArray.join(", ")}): ${returnType};\n`;
            } else if (
              paramsTs === "id: any" ||
              /^[\w$]+: .+$/.test(paramsTs)
            ) {
              // Single typed parameter like "id: any" or "body: CategoryRequest"
              methodsTs += `  ${methodName}(${paramsTs}): ${returnType};\n`;
            } else {
              // Default case for complex parameter objects
              methodsTs += `  ${methodName}(params: { ${paramsTs} }): ${returnType};\n`;
            }
          }
        }
      }
    }
  }

  if (!methodsTs) {
    methodsTs = `  // No methods generated for ${moduleName}. Check Swagger paths.\n`;
  }

  // Generate FormData interface imports
  const formDataImports = [];
  for (const interfaceName of formDataInterfaceNames) {
    formDataImports.push(interfaceName);
  }

  // Create import statement with FormData interfaces and response schema types
  const responseImports = [];
  for (const typeName of responseSchemaTypes) {
    responseImports.push(typeName);
  }

  // Add imports for list methods
  const listImports = [];
  if (importedListTypes.size > 0) {
    listImports.push("PaginationParams", "PaginationList", "ResponseObject");
    for (const typeName of importedListTypes) {
      // Avoid importing Category from papak/_modulesTypes
      if (typeName !== "Category") {
        listImports.push(typeName);
      }
    }
  }

  const allImports = [
    requestDtoName,
    mainModelName,
    ...formDataImports,
    ...responseImports,
  ];

  let finalImportStatement = `import { ${allImports.join(", ")} } from './models/${mainModelName}';\n`;
  if (listImports.length > 0) {
    finalImportStatement += `import { ${listImports.join(", ")} } from 'papak/_modulesTypes';\n`;
  }

  const content =
    `${finalImportStatement}` +
    `\n` +
    `export interface ${interfaceName} {\n${methodsTs}}\n`;
  const finalContent = await formatCode(content);
  await fs.writeFile(
    path.join(domainsDir, `${interfaceName}.ts`),
    finalContent
  );
}

module.exports = {
  generateServiceInterface,
};
