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
  const usedTypes = new Set();

  let hookMethodsTs = "";
  const paths = swaggerJson.paths || {};
  const basePath = swaggerJson.basePath || "";

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

          const hookName = `use${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}${operationSuffix.charAt(0).toUpperCase() + operationSuffix.slice(1)}`;

          const isMutation = !["get"].includes(method);
          const originalMethodName = camelize(
            operationId.replace(new RegExp(moduleName, "i"), "")
          );

          if (!operationId.toLowerCase().includes("help")) {
            const queryKeyName = originalMethodName.toLowerCase();
            if (!processedOperationsForQueryKeys.has(queryKeyName)) {
              queryKeysTs += `  ${queryKeyName}: '${queryKeyName}',\n`;
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

          if (operationId.toLowerCase().includes("help")) {
            continue;
          }

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

          const hookName = `use${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}${operationSuffix.charAt(0).toUpperCase() + operationSuffix.slice(1)}`;

          const originalMethodName = camelize(
            operationId.replace(new RegExp(moduleName, "i"), "")
          );
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
          let queryKeyArray = `[${moduleName}QueryKeys.${originalMethodName.toLowerCase()}]`;

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
                mutationFnString = `mutationFn: ({ id, body }: { id: number; body: CategoryRequest }) => Service.${originalMethodName}(id, body)`;
              }
            } else if (serviceCallArgs === "body") {
              mutationFnString = `mutationFn: (body: CategoryRequest) => Service.${originalMethodName}(body)`;
            }

            let keysToInvalidate = [];
            if (processedOperationsForQueryKeys.has("list")) {
              keysToInvalidate.push(`${moduleName}QueryKeys.list`);
            }
            if (processedOperationsForQueryKeys.has("retrieve")) {
              keysToInvalidate.push(`${moduleName}QueryKeys.retrieve`);
            }

            let keysToInvalidateWithOptions = [];
            // List queries use exact match
            if (processedOperationsForQueryKeys.has("list")) {
              keysToInvalidateWithOptions.push(
                `{ queryKey: [${moduleName}QueryKeys.list] }`
              );
            }
            // Retrieve queries use non-exact match (to invalidate all retrieval queries regardless of ID)
            if (processedOperationsForQueryKeys.has("retrieve")) {
              keysToInvalidateWithOptions.push(
                `{ queryKey: [${moduleName}QueryKeys.retrieve], exact: false }`
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
              queryKeyArray = `[${moduleName}QueryKeys.${originalMethodName.toLowerCase()}, id]`;
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

  const content =
    `import { ${serviceName} } from './${moduleDirName}.service';\n` +
    `import { ${mainModelName}CreateParams, CategoryRequest } from './domains/models/${mainModelName}';\n` +
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
    `export function ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Presentation() {\n` +
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
