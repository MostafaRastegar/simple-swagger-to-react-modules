const fs = require("fs").promises;
const path = require("path");
const { formatCode, camelize, mapSwaggerTypeToTs } = require("../utils");

/**
 * Generates presentation hooks for a given module.
 * @param {string} moduleOutputDir - The output directory for the module.
 * @param {string} moduleName - The name of the module.
 * @param {object} swaggerJson - The parsed Swagger JSON.
 */
async function generatePresentationHooks(
  moduleOutputDir,
  moduleName,
  swaggerJson
) {
  const serviceName = `${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Service`;
  const modelName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
  const moduleDirName = moduleName.toLowerCase();
  const mainModelName = modelName;
  const definitions = swaggerJson.definitions || {};
  const usedTypes = new Set(); // Track types that need to be imported

  let hookMethodsTs = "";
  const paths = swaggerJson.paths || {};
  const basePath = swaggerJson.basePath || "";

  // Collect FormData interface names that will be imported from models
  const formDataInterfaceNames = new Set();

  let queryKeysTs = `const ${moduleName}QueryKeys = {\n`;
  const processedOperationsForQueryKeys = new Set();

  // First pass: collect query keys for common operations
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
        if (["get", "post", "put", "delete"].includes(method)) {
          const operationId =
            operation.operationId ||
            `${method}_${pathUrl.replace(/\//g, "_").replace(/\{|\}/g, "")}`;

          const hookNameSuffix = operationId
            .replace(new RegExp(moduleName, "i"), "")
            .replace(/([a-z])([A-Z])/g, "$1_$2")
            .toLowerCase();
          const hookName = `use${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}${hookNameSuffix.charAt(0).toUpperCase() + hookNameSuffix.slice(1).replace(/_/g, "")}`;

          const isMutation = !["get"].includes(method);
          const originalMethodName = camelize(
            operationId.replace(new RegExp(moduleName, "i"), "")
          );

          // Only include main operations, skip help operations
          if (!operationId.toLowerCase().includes("help")) {
            const queryKeyName = originalMethodName
              .replace(/([A-Z])/g, "_$1")
              .toUpperCase();
            if (!processedOperationsForQueryKeys.has(queryKeyName)) {
              queryKeysTs += `  ${queryKeyName}: '${moduleName}_${originalMethodName}',\n`;
              processedOperationsForQueryKeys.add(queryKeyName);
            }
          }
        }
      }
    }
  }
  queryKeysTs += "};\n\n";

  // Second pass: generate hooks
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
        if (["get", "post", "put", "delete"].includes(method)) {
          const operationId =
            operation.operationId ||
            `${method}_${pathUrl.replace(/\//g, "_").replace(/\{|\}/g, "")}`;

          // Skip help operations
          if (operationId.toLowerCase().includes("help")) {
            continue;
          }

          const hookNameSuffix = operationId
            .replace(new RegExp(moduleName, "i"), "")
            .replace(/([a-z])([A-Z])/g, "$1_$2")
            .toLowerCase();
          const hookName = `use${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}${hookNameSuffix.charAt(0).toUpperCase() + hookNameSuffix.slice(1).replace(/_/g, "")}`;

          const originalMethodName = camelize(
            operationId.replace(new RegExp(moduleName, "i"), "")
          );
          const isMutation = !["get"].includes(method);

          let hookFn = isMutation ? "useMutation" : "useQuery";
          let hookParams = "";
          const allParams = operation.parameters || [];
          let usesUseParams = false; // Flag to check if useParams is used for an ID
          let idPathParam = null; // Store the ID path parameter if found
          const pathParams = allParams.filter((p) => p.in === "path");
          const queryParams = allParams.filter((p) => p.in === "query");
          const bodyParam =
            operation.requestBody?.content?.["application/json"]?.schema;
          const formDataParams = allParams.filter((p) => p.in === "formData");
          const formDataInterfaceNameForOperation =
            formDataParams.length > 0
              ? `${modelName}${camelize(operationId.replace(new RegExp(moduleName, "i"), ""))}FormData`
              : null;

          // Check if this is a GET operation with a single path parameter that could be an ID
          if (
            method === "get" &&
            pathParams.length === 1 &&
            !bodyParam &&
            !formDataParams.length
          ) {
            idPathParam = pathParams[0];
            usesUseParams = true;
          }

          let hookSignature = "()";
          let variablesType = "Record<string, any>";
          let serviceCallArgs = "";
          let queryKeyArray = `[${moduleName}QueryKeys.${originalMethodName
            .replace(/([A-Z])/g, "_$1")
            .toUpperCase()}]`;

          // Simplified logic based on serviceGenerator.js patterns
          if (
            pathParams.length === 1 &&
            pathParams[0].name === "id" &&
            !queryParams.length &&
            !bodyParam &&
            !formDataParams.length
          ) {
            // Case: only 'id' parameter (e.g., Retrieve, Destroy)
            if (isMutation) {
              hookSignature = "()";
              serviceCallArgs = `({ id }) => Service.${originalMethodName}(id)`;
            } else {
              usesUseParams = true;
              hookSignature = "()";
              serviceCallArgs = "id";
            }
          } else if (bodyParam || formDataParams.length > 0) {
            // Case: has body or formData
            if (
              pathParams.length === 1 &&
              pathParams[0].name === "id" &&
              !queryParams.length
            ) {
              // Case: 'id' and 'body' (e.g., Update)
              hookSignature = "()";
              serviceCallArgs = `({ id, body }) => Service.${originalMethodName}(id, body)`;
            } else if (queryParams.length > 0 || pathParams.length > 0) {
              // Case: path/query params and body
              hookSignature = "(params: Record<string, any>)";
              serviceCallArgs = "params, body";
            } else {
              // Case: only 'body' (e.g., Create)
              hookSignature = "(body: any)";
              serviceCallArgs = "body";
            }
          } else if (queryParams.length > 0 || pathParams.length > 0) {
            // Case: only path/query params
            if (
              method === "get" &&
              pathParams.length === 0 &&
              queryParams.length > 0
            ) {
              // GET with only query params (e.g., List)
              hookSignature = "(params: Record<string, any>)";
              serviceCallArgs = "params";
            } else {
              // For other cases (POST with path/query, GET with path params, etc.)
              if (pathParams.length > 0) {
                hookSignature = "()";
                usesUseParams = true;
                serviceCallArgs = "params";
              } else {
                hookSignature = "(params: Record<string, any>)";
                serviceCallArgs = "params";
              }
            }
          } else {
            // Default case: no parameters
            hookSignature = "()";
            serviceCallArgs = "()";
          }

          if (usesUseParams && idPathParam) {
            queryKeyArray = `[${moduleName}QueryKeys.${originalMethodName
              .replace(/([A-Z])/g, "_$1")
              .toUpperCase()}, id]`;
          } else if (queryParams.length > 0) {
            queryKeyArray = `[${moduleName}QueryKeys.${originalMethodName
              .replace(/([A-Z])/g, "_$1")
              .toUpperCase()}, ...(params ? Object.values(params).filter((v) => v !== undefined) : [])]`;
          }

          if (isMutation) {
            let mutationFnString = `mutationFn: ${serviceCallArgs}`;
            if (serviceCallArgs.includes("=>")) {
              mutationFnString = `mutationFn: ${serviceCallArgs}`;
            }

            // Determine query keys to invalidate
            // Default to common list query keys for the module
            let keysToInvalidate = [];
            // Check if common list keys were generated and add them
            if (processedOperationsForQueryKeys.has("LIST")) {
              keysToInvalidate.push(`${moduleName}QueryKeys.LIST`);
            }

            // Construct onSuccess handler with invalidateQueries
            let onSuccessHandlerString = "";
            if (keysToInvalidate.length > 0) {
              onSuccessHandlerString = `onSuccess: () => {\n`;
              keysToInvalidate.forEach((key) => {
                onSuccessHandlerString += `        queryClient.invalidateQueries({ queryKey: [${key}] });\n`;
              });
              onSuccessHandlerString += `      },\n`;
            }

            hookParams = `{ ${mutationFnString}${onSuccessHandlerString ? `, ${onSuccessHandlerString.trim()}` : ""} }`;

            hookMethodsTs +=
              `    ${hookName}: ${hookSignature} => {\n` +
              `      return useMutation(${hookParams});\n` +
              `    },\n`;
          } else {
            let hookBodyPreamble = "";
            let currentServiceCallArgs = serviceCallArgs;
            let currentEnabledCondition = "enabled: true";

            if (usesUseParams && idPathParam) {
              hookBodyPreamble = `  const { id } = useParams();\n`;
              if (serviceCallArgs === "params") {
                currentServiceCallArgs = "id";
              } else if (serviceCallArgs.includes("body")) {
                currentServiceCallArgs = serviceCallArgs
                  .replace("params, body", "id, body")
                  .replace("body", "id");
              }

              currentEnabledCondition = `enabled: !!id`;
            } else if (queryParams.length > 0 && serviceCallArgs === "params") {
              currentEnabledCondition = `enabled: Object.keys(params || {}).length > 0`;
            }

            const queryFnString = `queryFn: () => Service.${originalMethodName}(${currentServiceCallArgs})`;
            hookParams = `{ queryKey: ${queryKeyArray}, ${queryFnString}, ${currentEnabledCondition} }`;

            hookMethodsTs +=
              `    ${hookName}: ${hookSignature} => {\n` +
              `${hookBodyPreamble}` +
              `      return useQuery(${hookParams});\n` +
              `    },\n`;
          }
        }
      }
    }
  }

  if (!hookMethodsTs) {
    hookMethodsTs = "    // No hooks generated\n";
  }

  // Generate FormData interface imports from models
  const formDataImports = [];
  for (const interfaceName of formDataInterfaceNames) {
    formDataImports.push(interfaceName);
  }

  // Generate additional imports for used types
  let additionalImports = "";
  for (const typeName of usedTypes) {
    if (typeName.includes("CreateParams") || definitions[typeName]) {
      // Only import if it's a CreateParams type or defined in swagger definitions
      additionalImports += `import { ${typeName} } from './domains/models/${mainModelName}';\n`;
    }
  }

  // Generate FormData interface imports
  const formDataImportLine =
    formDataImports.length > 0
      ? `import { ${formDataImports.join(", ")} } from './domains/models/${mainModelName}';\n`
      : "";

  const content =
    `import { ${serviceName} } from './${moduleDirName}.service';\n` +
    `import { ${mainModelName}CreateParams } from './domains/models/${mainModelName}';\n` +
    `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\n` +
    `import { useParams } from 'next/navigation';\n` +
    `import { useSearchParamsToObject } from 'papak/utils/useSearchParamsToObject';\n` +
    `import { formErrorHandler } from 'papak/utils/formErrorHandler';\n` +
    `import { CustomError } from 'papak/utils/request/interceptors';\n` +
    `${formDataImportLine}` +
    `${additionalImports}\n` +
    `${queryKeysTs}` +
    `// PRESENTATION LAYER\n` +
    `// React Query hooks for ${moduleName}\n` +
    `export function ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Presentation() {\n` +
    `  const Service = ${serviceName}();\n` +
    `  const queryClient = useQueryClient();\n` +
    `  return {\n${hookMethodsTs}\n  };\n` +
    `}\n\n`;
  const finalContent = await formatCode(content, "typescript");
  await fs.writeFile(
    path.join(moduleOutputDir, `${moduleDirName}.presentation.ts`),
    finalContent
  );
}

module.exports = {
  generatePresentationHooks,
};
