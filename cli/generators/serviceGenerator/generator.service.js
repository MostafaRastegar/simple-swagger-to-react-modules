const fs = require("fs").promises;
const path = require("path");
const { formatCode, camelize } = require("../../utils");

/**
 * Generates the service implementation file.
 * @param {string} moduleOutputDir - The output directory for the module.
 * @param {string} moduleName - The name of the module.
 * @param {object} swaggerJson - The parsed Swagger JSON.
 * @param {string} baseUrl - The base API URL.
 */
async function generateServiceImplementation(
  moduleOutputDir,
  moduleName,
  swaggerJson,
  baseUrl
) {
  const serviceName = `${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Service`;
  const interfaceName = `I${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Service`;
  const modelName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
  const moduleDirName = moduleName.toLowerCase();
  const mainModelName = modelName;
  const moduleConstantName = moduleName.toUpperCase();
  const requestDtoName = `${modelName}CreateParams`;

  let serviceMethodsTs = "";
  const paths = swaggerJson.paths || {};
  const basePath = swaggerJson.basePath || "";
  const definitions =
    swaggerJson.definitions || swaggerJson.components?.schemas || {};
  const allDefinitions = definitions; // Keep for potential future use or consistency

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
          // Process path segments for new naming convention (same as endpoint generator)
          const pathSegments = pathUrl.substring(1).split("/"); // Removes leading '/' and splits
          const processedPathSegments = [];
          let skipNext = false;

          for (let i = 0; i < pathSegments.length; i++) {
            if (skipNext) {
              skipNext = false;
              continue;
            }

            const segment = pathSegments[i];
            if (!segment) continue; // Skip empty segments
            const nextSegment = pathSegments[i + 1];

            if (segment.startsWith("{") && segment.endsWith("}")) {
              // It's a path parameter, e.g., {petId} or {id}
              const paramName = segment.slice(1, -1); // Extract 'petId' or 'id'
              processedPathSegments.push(paramName.toUpperCase()); // e.g., 'PETID' or 'ID'
            } else {
              // Skip API version pattern (api/v1, api/v2, etc.)
              if (
                segment.toLowerCase() === "api" &&
                nextSegment &&
                /^v\d+$/.test(nextSegment)
              ) {
                skipNext = true; // Skip both api and v1 segments
              } else {
                // Regular path segment
                processedPathSegments.push(
                  segment
                    .replace(/([a-z])([A-Z])/g, "$1_$2") // Handle camelCase
                    .toUpperCase()
                );
              }
            }
          }

          const endpointNameSuffix = processedPathSegments.join("_"); // Join with underscores
          const endpointMethodName = `${method.toUpperCase()}_${endpointNameSuffix}`;
          const operationId =
            operation.operationId ||
            `${method}_${pathUrl.replace(/\//g, "_").replace(/\{|\}/g, "")}`;
          let methodName = camelize(
            operationId.replace(new RegExp(moduleName, "i"), "")
          );

          // Convert PascalCase to camelCase to match interface method names
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

          const allParams = operation.parameters || [];
          const pathParams = allParams.filter((p) => p.in === "path");
          const queryParams = allParams.filter((p) => p.in === "query");
          const bodyParam =
            operation.requestBody?.content?.["application/json"]?.schema;
          const formDataParams = allParams.filter((p) => p.in === "formData");

          const paramNamesForEndpoint = [];
          for (const param of allParams) {
            if (param.in === "path") {
              const paramName = param.name;
              paramNamesForEndpoint.push(paramName);
            }
          }

          const authRequired =
            operation.security &&
            (operation.security.some((s) =>
              Object.keys(s).includes("petstore_auth")
            ) ||
              operation.security.some((s) =>
                Object.keys(s).includes("api_key")
              ));
          const hasQueryParams = queryParams.length > 0;

          // Determine parameter signature for the service method
          let methodParamSignature = "";
          let methodCallArgs = "";
          let endpointCallArgs = "";
          let paramsObject = {};

          if (
            pathParams.length === 1 &&
            pathParams[0].name === "id" &&
            !queryParams.length &&
            !bodyParam &&
            !formDataParams.length
          ) {
            // Case: only 'id' parameter
            methodParamSignature = "(id)";
            methodCallArgs = "id";
            endpointCallArgs = "id";
          } else if (bodyParam || formDataParams.length > 0) {
            // Case: has body or formData
            if (
              pathParams.length === 1 &&
              pathParams[0].name === "id" &&
              !queryParams.length
            ) {
              // Case: 'id' and 'body' (e.g., Update)
              methodParamSignature = "(id, body)";
              methodCallArgs = "id, body";
              endpointCallArgs = "id";
            } else if (queryParams.length > 0 || pathParams.length > 0) {
              // Case: path/query params and body
              const pathQueryParams = [];
              for (const param of allParams) {
                if (param.in === "path" || param.in === "query") {
                  paramsObject[param.name] = param.name;
                }
              }
              methodParamSignature = "(params, body)";
              methodCallArgs = "params, body";
              endpointCallArgs = Object.keys(paramsObject).join(", ");
            } else {
              // Case: only 'body' (e.g., Create)
              methodParamSignature = "(body)";
              methodCallArgs = "body";
              endpointCallArgs = ""; // No path params
            }
          } else if (queryParams.length > 0 || pathParams.length > 0) {
            // Case: only path/query params
            if (
              method === "get" &&
              pathParams.length === 0 &&
              queryParams.length > 0
            ) {
              // Special handling for GET requests with only query parameters (e.g., List methods)
              for (const param of queryParams) {
                paramsObject[param.name] = param.name;
              }
              methodParamSignature = "(params)";
              methodCallArgs = "params";
              endpointCallArgs = ""; // No path arguments for GET endpoint
            } else {
              // For other cases (POST with path/query, GET with path params, etc.)
              for (const param of allParams) {
                if (param.in === "path" || param.in === "query") {
                  if (param.in === "path") {
                    paramsObject[param.name] = param.name;
                  }
                }
              }
              methodParamSignature = "(params)";
              methodCallArgs = "params";
              endpointCallArgs = Object.keys(paramsObject).join(", ");
            }
          } else {
            // Default case: no parameters
            methodParamSignature = "()";
            methodCallArgs = "";
            endpointCallArgs = "";
          }

          // Generate the request call
          let requestCall = "";
          if (method === "get" || method === "delete") {
            if (queryParams.length > 0 && endpointCallArgs) {
              requestCall = `request().${method}(endpoints.${moduleConstantName}.${endpointMethodName}(${endpointCallArgs}), { params })`;
            } else if (queryParams.length > 0 && !endpointCallArgs) {
              // GET with only query params (e.g. list)
              requestCall = `request().${method}(endpoints.${moduleConstantName}.${endpointMethodName}(), { params })`;
            } else if (endpointCallArgs) {
              requestCall = `request().${method}(endpoints.${moduleConstantName}.${endpointMethodName}(${endpointCallArgs}), {})`;
            } else {
              requestCall = `request().${method}(endpoints.${moduleConstantName}.${endpointMethodName}(), {})`;
            }
          } else if (method === "post" || method === "put") {
            if (formDataParams.length > 0) {
              requestCall = `request().${method}Form(endpoints.${moduleConstantName}.${endpointMethodName}(${endpointCallArgs}), body)`;
            } else {
              if (hasQueryParams) {
                requestCall = `request().${method}(endpoints.${moduleConstantName}.${endpointMethodName}(${endpointCallArgs}), body, { params })`;
              } else {
                requestCall = `request().${method}(endpoints.${moduleConstantName}.${endpointMethodName}(${endpointCallArgs}), body, {})`;
              }
            }
          }

          serviceMethodsTs += `  ${methodName}: ${methodParamSignature} =>\n      serviceHandler(() => ${requestCall}),\n`;
        }
      }
    }
  }

  if (!serviceMethodsTs) {
    serviceMethodsTs = "    // No methods implemented for service\n";
  }

  const content =
    `import { ${interfaceName} } from './domains/${interfaceName}';\n` +
    `import { ${mainModelName}, ${requestDtoName} } from './domains/models/${mainModelName}';\n` +
    `import { endpoints } from '@/constants/endpoints';\n` +
    `import { serviceHandler, request } from 'papak/helpers/serviceHandler';\n` +
    `\n` +
    `export function ${serviceName}(): ${interfaceName} {\n` +
    `  return {\n${serviceMethodsTs}\n  };\n` +
    `}\n\n`;
  const finalContent = await formatCode(content, "typescript");
  await fs.writeFile(
    path.join(moduleOutputDir, `${moduleDirName}.service.ts`),
    finalContent
  );
}

module.exports = {
  generateServiceImplementation,
};
