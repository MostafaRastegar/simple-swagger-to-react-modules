const fs = require("fs").promises;
const path = require("path");
const {
  formatCode,
  camelize,
  mapSwaggerTypeToTs,
  sanitizeInterfaceName,
} = require("../utils");

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
  const modelName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
  // Sanitize for TypeScript identifiers
  const sanitizedModelName = sanitizeInterfaceName(modelName);
  const serviceName = `${sanitizedModelName}Service`;
  const moduleDirName = moduleName.toLowerCase();
  const mainModelName = sanitizedModelName;
  const sanitizedModuleName = sanitizeInterfaceName(moduleName);
  const definitions = swaggerJson.definitions || {};

  let hookMethodsTs = "";
  const paths = swaggerJson.paths || {};
  const basePath = swaggerJson.basePath || "";

  const formDataInterfaceNames = new Set();
  let queryKeysTs = `const ${sanitizedModuleName}QueryKeys = {\n`;

  // Determine the correct request interface name
  const requestInterfaceName = `${sanitizedModelName}Request`;

  // First pass: collect all operations for query keys
  const allOperations = new Set();
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

          let operationSuffix = operationId.replace(
            new RegExp(moduleName, "i"),
            ""
          );
          // Clean up underscores and make PascalCase
          operationSuffix = operationSuffix
            .split("_")
            .map((part, index) =>
              index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
            )
            .join("");
          // Sanitize to remove all special characters and ensure valid identifier
          operationSuffix = sanitizeInterfaceName(operationSuffix);

          const hookName = `use${sanitizedModelName}${operationSuffix}`;

          const isMutation = !["get"].includes(method);
          let originalMethodName = camelize(
            operationId.replace(new RegExp(moduleName, "i"), "")
          );

          // Apply the same naming conversion as service generator
          if (originalMethodName.includes("_")) {
            const parts = originalMethodName.split("_");
            originalMethodName =
              parts[0].toLowerCase() +
              parts[1].charAt(0).toUpperCase() +
              parts[1].slice(1);
          } else {
            originalMethodName =
              originalMethodName.charAt(0).toLowerCase() +
              originalMethodName.slice(1);
          }

          // Add all operations to query keys including help operations
          allOperations.add(originalMethodName);
          queryKeysTs += `  ${originalMethodName}: '${originalMethodName}',\n`;
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

          // Process all operations including help operations

          let operationSuffix = operationId.replace(
            new RegExp(moduleName, "i"),
            ""
          );
          operationSuffix = operationSuffix
            .split("_")
            .map((part, index) =>
              index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
            )
            .join("");
          // Sanitize to remove all special characters and ensure valid identifier
          operationSuffix = sanitizeInterfaceName(operationSuffix);

          const hookName = `use${sanitizedModelName}${operationSuffix}`;

          let originalMethodName = camelize(
            operationId.replace(new RegExp(moduleName, "i"), "")
          );

          // Convert PascalCase to camelCase for method names to match service interface
          // Handle sub-module operations like "help_List" -> "helpList"
          if (originalMethodName.includes("_")) {
            const parts = originalMethodName.split("_");
            originalMethodName =
              parts[0].toLowerCase() +
              parts[1].charAt(0).toUpperCase() +
              parts[1].slice(1);
          } else {
            originalMethodName =
              originalMethodName.charAt(0).toLowerCase() +
              originalMethodName.slice(1);
          }

          const isMutation = !["get"].includes(method);

          let hookFn = isMutation ? "useMutation" : "useQuery";
          let hookParams = "";
          const allParams = operation.parameters || [];
          let usesUseParams = false;
          const pathParams = allParams.filter((p) => p.in === "path");
          const queryParams = allParams.filter((p) => p.in === "query");
          const bodyParam =
            operation.requestBody?.content?.["application/json"]?.schema;

          let hookSignature = "()";
          let serviceCallArgs = "";
          let queryKeyArray = `[${sanitizedModuleName}QueryKeys.${originalMethodName}]`;

          if (
            pathParams.length === 1 &&
            pathParams[0].name === "id" &&
            !queryParams.length &&
            !bodyParam
          ) {
            if (isMutation) {
              hookSignature = "()";
              serviceCallArgs = `({ id }) => Service.${originalMethodName}(id)`;
            } else {
              usesUseParams = true;
              hookSignature = "()";
              serviceCallArgs = "id";
            }
          } else if (bodyParam) {
            if (pathParams.length === 1 && pathParams[0].name === "id") {
              hookSignature = "(form?: FormInstance)";
              serviceCallArgs = `({ id, body }) => Service.${originalMethodName}(id, body)`;
            } else {
              hookSignature = "(form?: FormInstance)";
              serviceCallArgs = "body";
            }
          } else if (queryParams.length > 0) {
            hookSignature = "(params: PaginationParams)";
            serviceCallArgs = "params";
          } else {
            hookSignature = "()";
            serviceCallArgs = "()";
          }

          if (isMutation) {
            let mutationFnString = "";

            if (serviceCallArgs.includes("=>")) {
              if (serviceCallArgs.includes("({ id })")) {
                mutationFnString = `mutationFn: ({ id }: { id: number }) => Service.${originalMethodName}(id)`;
              } else if (serviceCallArgs.includes("({ id, body })")) {
                mutationFnString = `mutationFn: ({ id, body }: { id: number; body: ${requestInterfaceName} }) => Service.${originalMethodName}(id, body)`;
              }
            } else if (serviceCallArgs === "body") {
              mutationFnString = `mutationFn: (body: ${requestInterfaceName}) => Service.${originalMethodName}(body)`;
            } else if (serviceCallArgs === "()") {
              // Handle operations with no parameters
              mutationFnString = `mutationFn: () => Service.${originalMethodName}()`;
            }

            let keysToInvalidate = [];
            if (allOperations.has("list")) {
              keysToInvalidate.push(`${sanitizedModuleName}QueryKeys.list`);
            }
            if (allOperations.has("retrieve")) {
              keysToInvalidate.push(`${sanitizedModuleName}QueryKeys.retrieve`);
            }

            let keysToInvalidateWithOptions = [];
            // List queries use exact match
            if (allOperations.has("list")) {
              keysToInvalidateWithOptions.push(
                `{ queryKey: [${sanitizedModuleName}QueryKeys.list] }`
              );
            }
            // Retrieve queries use non-exact match (to invalidate all retrieval queries regardless of ID)
            if (allOperations.has("retrieve")) {
              keysToInvalidateWithOptions.push(
                `{ queryKey: [${sanitizedModuleName}QueryKeys.retrieve], exact: false }`
              );
            }

            let onSuccessHandlerString = "";
            if (keysToInvalidateWithOptions.length > 0) {
              onSuccessHandlerString = `onSuccess: () => {\n`;
              keysToInvalidateWithOptions.forEach((keyOption) => {
                onSuccessHandlerString += `        queryClient.invalidateQueries(${keyOption});\n`;
              });
              onSuccessHandlerString += `      }`;
            }

            let errorHandlerString = "";
            if (hookSignature.includes("FormInstance")) {
              errorHandlerString = `onError: (error) => { const errorDetails = error as unknown as CustomError; if (form) { formErrorHandler(form, errorDetails?.details); } }`;
            }

            hookParams = `{ ${mutationFnString}${onSuccessHandlerString ? `, ${onSuccessHandlerString.trim()}` : ""}${errorHandlerString ? `, ${errorHandlerString.trim()}` : ""} }`;

            hookMethodsTs +=
              `    ${hookName}: ${hookSignature} => {\n` +
              `      return useMutation(${hookParams});\n` +
              `    },\n`;
          } else {
            let hookBodyPreamble = "";
            let currentServiceCallArgs = serviceCallArgs;
            let currentEnabledCondition = "enabled: true";

            if (usesUseParams) {
              hookBodyPreamble = `  const { id } = useParams();\n`;
              currentServiceCallArgs = "id";
              currentEnabledCondition = `enabled: !!id`;
              // Update queryKeyArray to include the ID for per-item caching
              queryKeyArray = `[${sanitizedModuleName}QueryKeys.${originalMethodName}, id]`;
            } else if (queryParams.length > 0) {
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

  const formDataImports = [];
  const formDataImportLine = "";
  const usedTypes = new Set();

  // Extract used types from hookMethodsTs to build proper imports
  // Use dynamic regex pattern based on current module instead of hardcoded names
  const typePattern = new RegExp(
    `${mainModelName}CreateParams|[A-Z][a-zA-Z]*Request`,
    "g"
  );
  const importMatches = hookMethodsTs.match(typePattern);
  if (importMatches) {
    importMatches.forEach((match) => usedTypes.add(match));
  }

  // Always include the main model and create params
  usedTypes.add(requestInterfaceName);
  usedTypes.add(`${mainModelName}CreateParams`);

  const content =
    `import { ${serviceName} } from './${moduleDirName}.service';\n` +
    `import { ${Array.from(usedTypes).join(", ")} } from './domains/models/${mainModelName}';\n` +
    `import { PaginationParams } from 'papak/_modulesTypes';\n` +
    `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\n` +
    `import { useParams } from 'next/navigation';\n` +
    `import { useSearchParamsToObject } from 'papak/utils/useSearchParamsToObject';\n` +
    `import { formErrorHandler } from 'papak/utils/formErrorHandler';\n` +
    `import { CustomError } from 'papak/utils/request/interceptors';\n` +
    `import { type FormInstance } from 'antd';\n` +
    `${queryKeysTs}` +
    `// PRESENTATION LAYER\n` +
    `// React Query hooks for ${moduleName}\n` +
    `export function ${sanitizedModelName}Presentation() {\n` +
    `  const Service = ${serviceName}();\n` +
    `  const queryClient = useQueryClient();\n` +
    `  return {\n${hookMethodsTs}\n  };\n` +
    `}\n\n`;

  return fs.writeFile(
    path.join(moduleOutputDir, `${moduleDirName}.presentation.ts`),
    content
  );
}

module.exports = {
  generatePresentationHooks,
};
