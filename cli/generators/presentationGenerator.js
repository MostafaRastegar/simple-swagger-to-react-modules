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
  const formDataInterfaces = {};
  const definitions = swaggerJson.definitions || {};
  const usedTypes = new Set(); // Track types that need to be imported

  let hookMethodsTs = "";
  const paths = swaggerJson.paths || {};
  const basePath = swaggerJson.basePath || "";

  // Generate FormData interfaces
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
            const interfaceName = `${modelName}${camelize(operationId.replace(new RegExp(moduleName, "i"), ""))}FormData`;

            let interfaceProps = "";
            for (const param of formDataParams) {
              const paramType = mapSwaggerTypeToTs(param, definitions);
              const isOptional = !param.required;
              interfaceProps += `  ${param.name}${isOptional ? "?" : ""}: ${paramType};\n`;
            }

            // Use consistent interface naming
            const consistentInterfaceName = interfaceName;
            formDataInterfaces[consistentInterfaceName] = interfaceProps;
          }
        }
      }
    }
  }

  let queryKeysTs = `const ${moduleName}QueryKeys = {\n`;
  const processedOperationsForQueryKeys = new Set();

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

          if (isMutation) {
            if (
              originalMethodName.includes("ById") ||
              originalMethodName.includes("ByStatus") ||
              originalMethodName.includes("ByTags")
            ) {
              const queryKeyName = originalMethodName
                .replace(/([A-Z])/g, "_$1")
                .toUpperCase();
              if (!processedOperationsForQueryKeys.has(queryKeyName)) {
                queryKeysTs += `  ${queryKeyName}: '${moduleName}_${originalMethodName}',\n`;
                processedOperationsForQueryKeys.add(queryKeyName);
              }
            }
          } else {
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

          const originalMethodName = camelize(
            operationId.replace(new RegExp(moduleName, "i"), "")
          );
          const isMutation = !["get"].includes(method);

          let hookFn = isMutation ? "useMutation" : "useQuery";
          let hookParams = "";
          let serviceCallArgs = [];
          const allParams = operation.parameters || [];
          let variablesType = "any";
          let hasFormData = false;
          let usesUseParams = false; // Flag to check if useParams is used for an ID
          let idPathParam = null; // Store the ID path parameter if found

          // Check if this is a GET operation with a single path parameter that could be an ID
          if (method === "get" && allParams) {
            const pathParams = allParams.filter((p) => p.in === "path");
            if (pathParams.length === 1) {
              // Simplified: assume single path param is an ID for useParams
              idPathParam = pathParams[0];
              usesUseParams = true;
            }
          }

          // Generate proper types for variables
          let variableProps = "";
          let formDataInterfaceNameForOperation = null;
          for (const param of allParams) {
            if (param.in === "path" || param.in === "query") {
              // Skip adding this param to variables if it's the ID handled by useParams
              if (
                usesUseParams &&
                idPathParam &&
                param.name === idPathParam.name
              ) {
                serviceCallArgs.push(`id`); // Will be replaced by useParams value later
                continue;
              }
              const paramType = mapSwaggerTypeToTs(param, definitions);
              const isOptional = !param.required;
              variableProps += `${param.name}${isOptional ? "?" : ""}: ${paramType}, `;
              serviceCallArgs.push(`variables.${param.name}`);
            } else if (param.in === "body") {
              const bodySchema = param.schema || param;
              const bodyType = mapSwaggerTypeToTs(bodySchema, definitions);
              let bodyTypeName;

              if (definitions[bodyType] && bodyType !== mainModelName) {
                bodyTypeName = bodyType;
                usedTypes.add(bodyTypeName);
              } else if (bodyType === mainModelName) {
                bodyTypeName = `${mainModelName}CreateParams`;
                usedTypes.add(bodyTypeName);
              } else {
                bodyTypeName = `${mainModelName}CreateParams`;
                usedTypes.add(bodyTypeName);
              }

              variableProps += `body: ${bodyTypeName}, `;
              serviceCallArgs.push(`variables.body`);
            } else if (param.in === "formData") {
              if (!formDataInterfaceNameForOperation) {
                const operationId =
                  operation.operationId ||
                  `${method}_${pathUrl.replace(/\//g, "_").replace(/\{|\}/g, "")}`;
                formDataInterfaceNameForOperation = `${modelName}${camelize(operationId.replace(new RegExp(moduleName, "i"), ""))}FormData`;
              }
              // Do not add to variableProps or serviceCallArgs here, will be done once after the loop
            }
          }

          // Handle formData body after processing all params for the operation
          if (formDataInterfaceNameForOperation) {
            variableProps += `body: ${formDataInterfaceNameForOperation}, `;
            serviceCallArgs.push(`variables.body`);
          }

          if (variableProps.endsWith(", ")) {
            variableProps = variableProps.slice(0, -2);
          }
          // If useParams is used, variablesType might not include the ID
          if (
            usesUseParams &&
            idPathParam &&
            variableProps.includes(idPathParam.name)
          ) {
            // This case should ideally not happen if the 'continue' in the loop works
            // but as a fallback, remove id from variableProps if it was added
            const idRegex = new RegExp(
              `\\b${idPathParam.name}\\w*:\\s*[^,]+,\\s*`
            );
            variableProps = variableProps.replace(idRegex, "");
          }
          variablesType = `{ ${variableProps} }`;

          const serviceCall = `Service.${originalMethodName}(${serviceCallArgs.join(", ")})`;

          if (isMutation) {
            const mutationFnString = `mutationFn: () => ${serviceCall}`;

            // Determine query keys to invalidate
            // Default to common list query keys for the module
            let keysToInvalidate = [];
            // Check if common list keys were generated and add them
            // This assumes keys like FINDS_BY_STATUS, FINDS_BY_TAGS etc. are in queryKeysTs
            if (processedOperationsForQueryKeys.has("FINDS_BY_STATUS")) {
              keysToInvalidate.push(`${moduleName}QueryKeys.FINDS_BY_STATUS`);
            }
            if (processedOperationsForQueryKeys.has("FINDS_BY_TAGS")) {
              keysToInvalidate.push(`${moduleName}QueryKeys.FINDS_BY_TAGS`);
            }
            // Add more generic list keys if they exist and are relevant
            // For example, if there was a generic 'list' or 'all' endpoint
            if (processedOperationsForQueryKeys.has("GET_ALL")) {
              // Example
              keysToInvalidate.push(`${moduleName}QueryKeys.GET_ALL`);
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
              `    ${hookName}: (variables: ${variablesType}) => {\n` +
              `      return useMutation({ ${mutationFnString}${onSuccessHandlerString ? `, ${onSuccessHandlerString.trim()}` : ""} });\n` +
              `    },\n`;
          } else {
            let queryKeyArray = `[${moduleName}QueryKeys.`;
            const queryKeySuffix = originalMethodName
              .replace(/([A-Z])/g, "_$1")
              .toUpperCase();
            queryKeyArray += `${queryKeySuffix}`;

            const pathQueryParams = allParams.filter(
              (p) => p.in === "path" || p.in === "query"
            );

            // If useParams is used, the hook signature changes and id is not in variables
            let hookSignatureParams = `(variables: ${variablesType})`;
            let hookBodyPreamble = "";
            let currentServiceCall = serviceCall;
            let currentEnabledCondition = "enabled: true";

            if (usesUseParams && idPathParam) {
              hookSignatureParams = "()"; // No variables needed for ID
              hookBodyPreamble = `  const { id } = useParams();\n`;
              // Replace placeholder 'id' in serviceCallArgs with actual 'id' from useParams
              currentServiceCall = `Service.${originalMethodName}(${serviceCallArgs.map((arg) => (arg === "id" ? "id" : arg)).join(", ")})`;

              // Update queryKey to use the id from useParams
              if (pathQueryParams.length > 0) {
                // Filter out the idPathParam from pathQueryParams for queryKey
                const otherPathQueryParams = pathQueryParams.filter(
                  (p) => p.name !== idPathParam.name
                );
                if (otherPathQueryParams.length > 0) {
                  queryKeyArray += `, ${otherPathQueryParams.map((p) => `JSON.stringify(variables.${p.name})`).join(", ")}`;
                } else {
                  queryKeyArray += `, id`; // Add id directly if it's the only path param (handled by useParams)
                }
              } else {
                queryKeyArray += `, id`; // Add id directly if no other path/query params
              }

              // Update enabled condition
              if (allParams.some((p) => p.in === "body")) {
                const requiredBodyParamNames = allParams
                  .filter((p) => p.in === "body" && p.required)
                  .map((p) => `variables.${p.name}`);
                if (requiredBodyParamNames.length > 0) {
                  currentEnabledCondition = `enabled: ${requiredBodyParamNames.join(" && ")}`;
                } else if (allParams.some((p) => p.in === "body")) {
                  currentEnabledCondition = `enabled: Object.keys(variables || {}).length > 0`;
                }
              } else {
                currentEnabledCondition = `enabled: !!id`;
              }
            } else {
              // Original logic for non-ID GETs
              if (pathQueryParams.length > 0) {
                queryKeyArray += `, ${pathQueryParams.map((p) => `JSON.stringify(variables.${p.name})`).join(", ")}`;
              }
              currentServiceCall = serviceCall; // Use original serviceCall
              if (
                pathQueryParams.length > 0 ||
                allParams.some((p) => p.in === "body")
              ) {
                const requiredParamNames = allParams
                  .filter((p) => p.required)
                  .map((p) => `variables.${p.name}`);
                if (requiredParamNames.length > 0) {
                  currentEnabledCondition = `enabled: ${requiredParamNames.join(" && ")}`;
                } else if (allParams.length > 0) {
                  currentEnabledCondition = `enabled: Object.keys(variables || {}).length > 0`;
                }
              }
            }
            queryKeyArray += `]`;

            const queryFnString = `queryFn: () => ${currentServiceCall}`;
            hookParams = `{ queryKey: ${queryKeyArray}, ${queryFnString}, ${currentEnabledCondition} }`;

            let queryGenericType = mainModelName;
            const successResponse = operation.responses["200"]?.schema;
            if (successResponse && successResponse.type === "array") {
              queryGenericType = `Array<${mainModelName}>`;
            }

            hookMethodsTs +=
              `    ${hookName}: ${hookSignatureParams} => {\n` +
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

  // Generate FormData interface imports
  let formDataImports = "";
  for (const [interfaceName, props] of Object.entries(formDataInterfaces)) {
    formDataImports += `export interface ${interfaceName} {\n${props}}\n\n`;
  }

  // Generate additional imports for used types
  let additionalImports = "";
  for (const typeName of usedTypes) {
    if (typeName.includes("CreateParams") || definitions[typeName]) {
      // Only import if it's a CreateParams type or defined in swagger definitions
      additionalImports += `import { ${typeName} } from './domains/models/${mainModelName}';\n`;
    }
  }

  const content =
    `${formDataImports}` +
    `import { ${serviceName} } from './${moduleDirName}.service';\n` +
    `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\n` +
    `import { useParams } from 'next/navigation';\n` +
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
