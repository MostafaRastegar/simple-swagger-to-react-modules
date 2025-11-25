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
                    .replace(/[^a-zA-Z0-9]/g, "_") // Replace hyphens and special chars with underscores
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
          let pathParamNames = [];
          let queryParamNames = [];

          // Separate path and query parameters
          for (const param of allParams) {
            if (param.in === "path") {
              pathParamNames.push(param.name);
            } else if (param.in === "query") {
              queryParamNames.push(param.name);
            }
          }

          // Build endpoint call arguments (path params in order)
          endpointCallArgs = pathParamNames.join(", ");

          if (bodyParam || formDataParams.length > 0) {
            // Has body parameter
            if (queryParamNames.length > 0) {
              // Has both query params and body - pass as params object and body
              methodParamSignature = "(params, body)";
              methodCallArgs = "params, body";
            } else {
              // Only body parameter
              if (pathParamNames.length > 0) {
                // Has both path params and body
                methodParamSignature = `(${pathParamNames.join(", ")}, body)`;
                methodCallArgs = `${pathParamNames.join(", ")}, body`;
              } else {
                // Only body
                methodParamSignature = "(body)";
                methodCallArgs = "body";
              }
            }
          } else {
            // No body parameter
            if (pathParamNames.length > 0 && queryParamNames.length > 0) {
              // Has both path params and query params
              methodParamSignature = `(${pathParamNames.join(", ")}, params)`;
              methodCallArgs = `${pathParamNames.join(", ")}, params`;
            } else if (
              pathParamNames.length === 1 &&
              pathParamNames[0] === "id" &&
              queryParamNames.length === 0
            ) {
              // Simple case: only 'id' path param
              methodParamSignature = "(id)";
              methodCallArgs = "id";
            } else if (pathParamNames.length > 0) {
              // Only path params (no query params or body)
              methodParamSignature = `(${pathParamNames.join(", ")})`;
              methodCallArgs = pathParamNames.join(", ");
            } else if (queryParamNames.length > 0) {
              // Only query params
              methodParamSignature = "(params)";
              methodCallArgs = "params";
              endpointCallArgs = ""; // No path args needed for GET
            } else {
              // No parameters
              methodParamSignature = "()";
              methodCallArgs = "";
              endpointCallArgs = "";
            }
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
  // Use content directly without formatting to avoid Prettier corruption of long property names
  const finalContent = content;
  await fs.writeFile(
    path.join(moduleOutputDir, `${moduleDirName}.service.ts`),
    finalContent
  );
}

module.exports = {
  generateServiceImplementation,
};
