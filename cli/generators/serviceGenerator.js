const fs = require("fs").promises;
const path = require("path");
const { formatCode, mapSwaggerTypeToTs, camelize } = require("../utils");

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
  const interfaceName = `I${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Service`;
  const modelName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
  const requestDtoName = `${modelName}CreateParams`;
  const responseTypeName = "ResponseObject";

  let methodsTs = "";
  const paths = swaggerJson.paths || {};
  const basePath = swaggerJson.basePath || "";
  const mainModelName = modelName;
  const definitions = swaggerJson.definitions || {};

  // Collect FormData interface names for import
  const formDataInterfaceNames = new Set();

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
          const methodName = camelize(
            operationId.replace(new RegExp(moduleName, "i"), "")
          );

          let paramsTs = "";
          const allParams = operation.parameters || [];
          const pathParams = allParams.filter((p) => p.in === "path");
          const queryParams = allParams.filter((p) => p.in === "query");
          const bodyParam = allParams.find((p) => p.in === "body");
          const formDataParams = allParams.filter((p) => p.in === "formData");

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
            const formDataInterface = `${mainModelName}${camelize(operationId.replace(new RegExp(moduleName, "i"), ""))}FormData`;
            formDataInterfaceNames.add(formDataInterface);
            paramsTs += `body: ${formDataInterface}, `;
          }

          // Handle body parameter
          if (bodyParam) {
            const bodyType = mapSwaggerTypeToTs(bodyParam.schema, definitions);
            if (definitions[bodyType] && bodyType !== mainModelName) {
              paramsTs += `body: ${bodyType}, `;
            } else if (bodyType === mainModelName || requestDtoName) {
              paramsTs += `body: ${requestDtoName}, `;
            } else {
              paramsTs += `body: Record<string, any>, `;
            }
          }

          if (paramsTs.endsWith(", ")) {
            paramsTs = paramsTs.slice(0, -2);
          }

          // Generate proper return type based on response schema
          let returnType = `Promise<${responseTypeName}<${mainModelName}>>`;
          const successResponse =
            operation.responses["200"]?.schema ||
            operation.responses.default?.schema;

          if (successResponse) {
            // For array responses like findPetsByStatus, findPetsByTags
            if (successResponse.type === "array" && successResponse.items) {
              const itemType = mapSwaggerTypeToTs(
                successResponse.items,
                definitions
              );
              returnType = `Promise<${responseTypeName}<Array<${itemType}>>>`;
            }
            // For single object responses like getPetById
            else if (successResponse.$ref) {
              const refType = mapSwaggerTypeToTs(successResponse, definitions);
              returnType = `Promise<${responseTypeName}<${refType}>>`;
            }
            // For other types
            else {
              const resolvedType = mapSwaggerTypeToTs(
                successResponse,
                definitions
              );
              returnType = `Promise<${responseTypeName}<${resolvedType}>>`;
            }
          }

          methodsTs += `  ${methodName}(${paramsTs}): ${returnType};\n`;
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

  // Create import statement with FormData interfaces
  const allImports = [requestDtoName, mainModelName, ...formDataImports];
  const importStatement = `import { ${allImports.join(", ")} } from './models/${mainModelName}';\n`;

  const content =
    `${importStatement}` +
    `\n` +
    `// Response wrapper type\n` +
    `type ${responseTypeName}<T> = {\n` +
    `  data: T;\n` +
    `  status: number;\n` +
    `  message?: string;\n` +
    `};\n` +
    `\n` +
    `export interface ${interfaceName} {\n${methodsTs}}\n`;
  const finalContent = await formatCode(content);
  await fs.writeFile(
    path.join(domainsDir, `${interfaceName}.ts`),
    finalContent
  );
}

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
  const allDefinitions = swaggerJson.definitions || {};

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
          const processedPathSegments = pathSegments.map((segment) => {
            if (segment.startsWith("{") && segment.endsWith("}")) {
              // It's a path parameter, e.g., {petId} or {id}
              const paramName = segment.slice(1, -1); // Extract 'petId' or 'id'
              return paramName.toUpperCase(); // e.g., 'PETID' or 'ID'
            } else {
              // It's a regular path segment, e.g., 'pet' or 'uploadImage'
              // Handle camelCase by inserting underscore before capital letters
              return segment
                .replace(/([a-z])([A-Z])/g, "$1_$2") // e.g., 'uploadImage' -> 'upload_Image'
                .toUpperCase(); // e.g., 'UPLOAD_IMAGE'
            }
          });

          const endpointNameSuffix = processedPathSegments.join("_"); // Join with underscores
          const endpointMethodName = `${method.toUpperCase()}_${endpointNameSuffix}`;
          const operationId =
            operation.operationId ||
            `${method}_${pathUrl.replace(/\//g, "_").replace(/\{|\}/g, "")}`;
          const methodName = camelize(
            operationId.replace(new RegExp(moduleName, "i"), "")
          );

          const allParams = operation.parameters || [];
          const pathParams = allParams.filter((p) => p.in === "path");
          const queryParams = allParams.filter((p) => p.in === "query");
          const bodyParam = allParams.find((p) => p.in === "body");
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

          let requestCall = "";
          const endpointFnCall = `endpoints.${moduleConstantName}.${endpointMethodName}(${paramNamesForEndpoint.join(", ")})`;

          // Unified parameter handling
          const hasQueryParams = queryParams.length > 0;
          const hasBody = bodyParam || formDataParams.length > 0;

          if (method === "get" || method === "delete") {
            if (hasQueryParams) {
              // Pass query parameters as individual arguments
              const queryParamsForCall = queryParams
                .map((qp) => qp.name)
                .join(", ");
              requestCall = `request().${method}(${endpointFnCall}, { params: { ${queryParamsForCall} } })`;
            } else {
              requestCall = `request().${method}(${endpointFnCall}, {})`;
            }
          } else if (method === "post" || method === "put") {
            if (formDataParams.length > 0) {
              requestCall = `request().${method}Form(${endpointFnCall}, body)`;
            } else {
              if (hasQueryParams) {
                // Pass query parameters as individual arguments
                const queryParamsForCall = queryParams
                  .map((qp) => qp.name)
                  .join(", ");
                requestCall = `request().${method}(${endpointFnCall}, body, { params: { ${queryParamsForCall} } })`;
              } else {
                requestCall = `request().${method}(${endpointFnCall}${hasBody ? ", body" : ""}, {})`;
              }
            }
          }

          // Unified parameter collection
          const paramNames = [];

          // Always include path parameters
          pathParams.forEach((p) => paramNames.push(p.name));

          // Include queryParams as individual parameters (not as an object)
          queryParams.forEach((qp) => {
            paramNames.push(qp.name);
          });

          // Include body as single object
          if (bodyParam || formDataParams.length > 0) {
            paramNames.push("body");
          }

          const methodParams =
            paramNames.length > 0 ? paramNames.join(", ") : "";

          if (authRequired) {
            serviceMethodsTs += `  ${methodName}: (${methodParams}) =>\n      serviceHandler(() => ${requestCall}),\n`;
          } else {
            let requestCallWithoutAuth = requestCall.replace(
              "request()",
              "requestWithoutAuth"
            );
            serviceMethodsTs += `  ${methodName}: (${methodParams}) =>\n      serviceHandler(() => ${requestCallWithoutAuth}),\n`;
          }
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
    `import { endpoints } from '../constants/endpoints';\n` +
    `import { serviceHandler, request, requestWithoutAuth } from 'papak/helpers/serviceHandler';\n` +
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
  generateServiceInterface,
  generateServiceImplementation,
};
