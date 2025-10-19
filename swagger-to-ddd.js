#!/usr/bin/env node

const { Command } = require("commander");
const fs = require("fs").promises;
const path = require("path");
const prettier = require("prettier");

const program = new Command();

program
  .name("swagger-to-ddd")
  .description("CLI to generate DDD modules from Swagger JSON")
  .version("1.0.0");

program
  .command("generate")
  .alias("g")
  .description("Generate DDD module from swagger.json")
  .requiredOption("-i, --input <file>", "Input Swagger JSON file path")
  .requiredOption(
    "-m, --module-name <name>",
    "Name of the module (e.g., pet, user)"
  )
  .requiredOption(
    "-o, --output-dir <dir>",
    "Output directory for the module (e.g., src/modules)"
  )
  .option(
    "--base-url <url>",
    "Base API URL (default: https://petstore.swagger.io/v2)",
    "https://petstore.swagger.io/v2"
  )
  .action(async (options) => {
    try {
      console.log(`Reading Swagger file from: ${options.input}`);
      const swaggerContent = await fs.readFile(options.input, "utf-8");
      const swaggerJson = JSON.parse(swaggerContent);

      const moduleOutputDir = path.join(
        process.cwd(),
        options.outputDir,
        options.moduleName
      );
      const domainsDir = path.join(moduleOutputDir, "domains");
      const modelsDir = path.join(domainsDir, "models");
      const constantsDir = path.join(
        process.cwd(),
        options.outputDir.split("/").slice(0, -1).join("/"),
        "constants"
      );

      await fs.mkdir(modelsDir, { recursive: true });
      await fs.mkdir(domainsDir, { recursive: true });
      try {
        await fs.mkdir(constantsDir, { recursive: true });
      } catch (mkdirErr) {
        if (mkdirErr.code !== "EEXIST") {
          throw mkdirErr;
        }
      }

      console.log(
        `Generating module '${options.moduleName}' in: ${moduleOutputDir}`
      );

      // 1. Generate models
      console.log("Generating models...");
      const definitions = swaggerJson.definitions || {};
      await generateModelFiles(modelsDir, options.moduleName, definitions);

      // 2. Generate service interface
      console.log("Generating service interface...");
      await generateServiceInterface(
        domainsDir,
        options.moduleName,
        swaggerJson,
        options.baseUrl
      );

      // 3. Generate service implementation
      console.log("Generating service implementation...");
      await generateServiceImplementation(
        moduleOutputDir,
        options.moduleName,
        swaggerJson,
        options.baseUrl
      );

      // 4. Generate presentation hooks
      console.log("Generating presentation hooks...");
      await generatePresentationHooks(
        moduleOutputDir,
        options.moduleName,
        swaggerJson
      );

      // 5. Update or create endpoints.ts
      console.log("Updating/Creating endpoints.ts...");
      await updateEndpointsFile(
        constantsDir,
        options.moduleName,
        swaggerJson,
        options.baseUrl
      );

      console.log(
        `Successfully generated DDD module for '${options.moduleName}'!`
      );
    } catch (error) {
      console.error("Error generating module:", error);
      process.exit(1);
    }
  });

program.parse();

async function formatCode(code, parser = "typescript") {
  try {
    return prettier.format(code, {
      parser,
      semi: true,
      singleQuote: true,
      tabWidth: 2,
    });
  } catch (error) {
    console.error("Prettier formatting error:", error);
    return code;
  }
}

async function generateModelFiles(modelsDir, moduleName, definitions) {
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

function mapSwaggerTypeToTs(schema, definitions = {}) {
  if (schema.$ref) {
    const refName = schema.$ref.split("/").pop();
    const definition = definitions[refName];
    if (definition) {
      // If a definition is found, recursively process its properties
      // This will generate the full inline structure for the reference
      return mapSwaggerTypeToTs(definition, definitions);
    }
    // If definition not found, just return the type name as a fallback
    return refName;
  }
  if (schema.type === "array") {
    const itemsType = schema.items
      ? mapSwaggerTypeToTs(schema.items, definitions)
      : "any";
    return `Array<${itemsType}>`;
  }
  if (schema.type === "integer" && schema.format === "int64") return "number";
  if (schema.type === "integer") return "number";
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "string") {
    if (schema.enum) return schema.enum.map((e) => `'${e}'`).join(" | ");
    return "string";
  }
  if (schema.type === "object") {
    if (schema.properties) {
      // For inline objects, build their structure.
      // This is more complex and might require a helper or iterative approach for deeply nested objects.
      // For now, let's return a generic object type or attempt to build a simple one.
      // A simple approach: return Record<string, any>
      // A more complex approach would be to build an inline interface, which is tricky here.
      // Let's stick to Record<string, any> for inline objects for now,
      // as the primary goal is to resolve $refs.
      return "Record<string, any>";
    }
    return "object";
  }
  return "any";
}

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

          // Handle path and query parameters
          for (const param of allParams) {
            if (param.in === "path" || param.in === "query") {
              const paramType = mapSwaggerTypeToTs(param, definitions);
              const isOptional = !param.required;
              // Use original swagger param name for the interface
              paramsTs += `${param.name}${isOptional ? "?" : ""}: ${paramType}, `;
            }
          }

          // Handle body parameter
          if (bodyParam) {
            const bodyType = mapSwaggerTypeToTs(bodyParam.schema, definitions);
            // Check if the bodyType is a known definition and use it directly
            // This assumes that the body schema refers to a specific model or DTO
            if (definitions[bodyType] && bodyType !== mainModelName) {
              // If it's a different model, use it directly
              paramsTs += `body: ${bodyType}, `;
            } else if (bodyType === mainModelName || requestDtoName) {
              // If it's the main model or a create DTO, use the DTO
              paramsTs += `body: ${requestDtoName}, `;
            } else {
              // Fallback to a generic type if no specific DTO is found
              paramsTs += `body: Record<string, any>, `;
            }
          }

          if (paramsTs.endsWith(", ")) {
            paramsTs = paramsTs.slice(0, -2);
          }

          let returnType = `Promise<${responseTypeName}<${mainModelName}>>`;
          const successResponse =
            operation.responses["200"]?.schema ||
            operation.responses.default?.schema;

          if (successResponse) {
            const resolvedType = mapSwaggerTypeToTs(
              successResponse,
              definitions
            );
            if (successResponse.type === "array") {
              // For array responses, use Array<T> for now
              // Can be enhanced to use PaginationList<T> if needed
              returnType = `Promise<${responseTypeName}<Array<${resolvedType}>>>`;
            } else {
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

  const content =
    `import { ${requestDtoName}, ${mainModelName} } from './models/${mainModelName}';\n` +
    `import { ${responseTypeName} } from 'papak/_modulesTypes';\n` +
    `\n` +
    `export interface ${interfaceName} {\n${methodsTs}}\n`;
  const finalContent = await formatCode(content);
  await fs.writeFile(
    path.join(domainsDir, `${interfaceName}.ts`),
    finalContent
  );
}

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
          const operationId =
            operation.operationId ||
            `${method}_${pathUrl.replace(/\//g, "_").replace(/\{|\}/g, "")}`;
          // Convert methodName to UPPER_SNAKE_CASE for endpoint constants
          const endpointMethodName = operationId
            .replace(new RegExp(moduleName, "i"), "")
            .replace(/([a-z])([A-Z])/g, "$1_$2")
            .toUpperCase();
          const methodName = camelize(
            operationId.replace(new RegExp(moduleName, "i"), "")
          );

          const allParams = operation.parameters || [];
          const pathParams = allParams.filter((p) => p.in === "path");
          const queryParams = allParams.filter((p) => p.in === "query");
          const bodyParam = allParams.find((p) => p.in === "body");

          const paramNamesForEndpoint = []; // For passing to endpoint functions

          for (const param of allParams) {
            if (param.in === "path" || param.in === "query") {
              const paramName = param.name; // Keep original swagger param name
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

          if (method === "get" || method === "delete") {
            const options =
              queryParams.length > 0
                ? `{ params: { ${queryParams.map((p) => `${p.name}: ${p.name}`).join(", ")} } }`
                : "{}";
            requestCall = `request().${method}(${endpointFnCall}, ${options})`;
          } else if (method === "post" || method === "put") {
            requestCall = `request().${method}(${endpointFnCall}${bodyParam ? ", body" : ""})`;
          }

          if (authRequired) {
            serviceMethodsTs += `  ${methodName}: (body) =>\n      serviceHandler(() => ${requestCall}),\n`;
          } else {
            let requestCallWithoutAuth = requestCall.replace(
              "request()",
              "requestWithoutAuth"
            );
            serviceMethodsTs += `  ${methodName}: (body) =>\n      serviceHandler(() => ${requestCallWithoutAuth}),\n`;
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
    `function ${serviceName}(): ${interfaceName} {\n` +
    `  return {\n${serviceMethodsTs}\n  };\n` +
    `}\n\n` +
    `export { ${serviceName} };\n`;
  const finalContent = await formatCode(content, "typescript");
  await fs.writeFile(
    path.join(moduleOutputDir, `${moduleDirName}.service.ts`),
    finalContent
  );
}

async function generatePresentationHooks(
  moduleOutputDir,
  moduleName,
  swaggerJson
) {
  const serviceName = `${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Service`;
  const modelName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
  const moduleDirName = moduleName.toLowerCase();
  const mainModelName = modelName; // For useQuery type hint

  let hookMethodsTs = "";
  const paths = swaggerJson.paths || {};
  const basePath = swaggerJson.basePath || "";
  // const mainModelName = modelName; // Already defined

  // Define query keys for React Query, similar to stuffs-example
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

          // Use a more descriptive hook name based on operationId
          const hookNameSuffix = operationId
            .replace(new RegExp(moduleName, "i"), "")
            .replace(/([a-z])([A-Z])/g, "$1_$2") // Add underscore before capital letters
            .toLowerCase(); // Convert to lowercase for consistency
          const hookName = `use${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}${hookNameSuffix.charAt(0).toUpperCase() + hookNameSuffix.slice(1).replace(/_/g, "")}`;

          const isMutation = !["get"].includes(method);
          const originalMethodName = camelize(
            operationId.replace(new RegExp(moduleName, "i"), "")
          );

          if (isMutation) {
            // For mutations, define a query key if it's a specific item operation (e.g., update, delete)
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
            // For queries, define a query key
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

          // Build arguments for service call
          for (const param of allParams) {
            if (param.in === "path" || param.in === "query") {
              serviceCallArgs.push(`variables.${param.name}`);
            } else if (param.in === "body") {
              serviceCallArgs.push(`variables.body`);
            }
          }

          const serviceCall = `Service.${originalMethodName}(${serviceCallArgs.join(", ")})`;

          if (isMutation) {
            const mutationFnString = `mutationFn: () => ${serviceCall}`;
            const onSuccessString = "onSuccess";
            const onErrorString = "onError";
            hookParams = `{ ${mutationFnString}, ${onSuccessString}, ${onErrorString} }`;

            hookMethodsTs +=
              `    ${hookName}: (variables: any, onSuccess?: (data: any) => void, onError?: (error: any) => void) => \n` +
              `      useMutation(${hookParams}),\n`;
          } else {
            // For queries, determine queryKey and queryFn
            let queryKeyArray = `[${moduleName}QueryKeys.`;
            const queryKeySuffix = originalMethodName
              .replace(/([A-Z])/g, "_$1")
              .toUpperCase();
            queryKeyArray += `${queryKeySuffix}`;

            // Add path/query params to queryKey for uniqueness
            const pathQueryParams = allParams.filter(
              (p) => p.in === "path" || p.in === "query"
            );
            if (pathQueryParams.length > 0) {
              queryKeyArray += `, ${pathQueryParams.map((p) => `JSON.stringify(variables.${p.name})`).join(", ")}`;
            }
            queryKeyArray += `]`;

            const queryFnString = `queryFn: () => ${serviceCall}`;

            let enabledCondition = "enabled: true"; // Default
            if (
              pathQueryParams.length > 0 ||
              allParams.some((p) => p.in === "body")
            ) {
              // Enable if there are variables that are required for the query
              const requiredParamNames = allParams
                .filter((p) => p.required)
                .map((p) => `variables.${p.name}`);
              if (requiredParamNames.length > 0) {
                enabledCondition = `enabled: ${requiredParamNames.join(" && ")}`;
              } else if (allParams.length > 0) {
                // If params exist but none are strictly required
                enabledCondition = `enabled: Object.keys(variables || {}).length > 0`;
              }
            }

            hookParams = `{ queryKey: ${queryKeyArray}, ${queryFnString}, ${enabledCondition} }`;

            // Determine type for useQuery. If response is an array, use Array<T>, else T.
            // This is a simplification; ideally, infer from operation.responses["200"].schema.type
            let queryGenericType = mainModelName;
            const successResponse = operation.responses["200"]?.schema;
            if (successResponse && successResponse.type === "array") {
              queryGenericType = `Array<${mainModelName}>`;
            }

            hookMethodsTs +=
              `    ${hookName}: (variables: any) => \n` +
              `      useQuery(${hookParams}),\n`;
          }
        }
      }
    }
  }

  if (!hookMethodsTs) {
    hookMethodsTs = "    // No hooks generated\n";
  }

  const content =
    `import { ${serviceName} } from './${moduleDirName}.service';\n` +
    `import { useQuery, useMutation } from '@tanstack/react-query';\n` +
    // `import { useSearchParamsToObject } from 'papak/utils/useSearchParamsToObject';\n` + // Removed unused import
    `import { useParams } from 'next/navigation';\n` +
    `// import { useRouter } from 'next/navigation';\n\n` +
    `${queryKeysTs}` +
    `// PRESENTATION LAYER\n` +
    `// React Query hooks for ${moduleName}\n` +
    `function ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Presentation() {\n` +
    `  const Service = ${serviceName}();\n` +
    `  // const queryParams = useParams(); // Assuming this might be used for store_id like in stuffs-example\n` + // Commented out if not used
    `  return {\n${hookMethodsTs}\n  };\n` +
    `}\n\n` +
    `export { ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Presentation };\n`;
  const finalContent = await formatCode(content, "typescript");
  await fs.writeFile(
    path.join(moduleOutputDir, `${moduleDirName}.presentation.ts`),
    finalContent
  );
}

async function updateEndpointsFile(
  constantsDir,
  moduleName,
  swaggerJson,
  baseUrl
) {
  const endpointFileName = "endpoints.ts";
  const endpointFilePath = path.join(constantsDir, endpointFileName);
  const moduleConstantName = moduleName.toUpperCase();

  let currentEndpoints = {};

  if (await fileExists(endpointFilePath)) {
    try {
      const existingContent = await fs.readFile(endpointFilePath, "utf-8");
      const match = existingContent.match(
        /export const endpoints\s*=\s*({[\s\S]*});/
      );
      if (match && match[1]) {
        const objectContent = match[1]
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/.*$/gm, "")
          .trim();
        try {
          currentEndpoints = JSON.parse(objectContent);
        } catch (e) {
          console.warn(
            `Could not parse existing endpoints object in ${endpointFilePath}, starting fresh for merge. Error: ${e.message}`
          );
          currentEndpoints = {};
        }
      }
    } catch (parseError) {
      console.warn(
        `Error reading or parsing existing endpoints.ts: ${parseError}. Starting fresh.`
      );
      currentEndpoints = {};
    }
  }

  const newModuleEndpoints = generateModuleEndpointsSwagger(
    moduleName,
    swaggerJson,
    baseUrl
  );

  currentEndpoints[moduleConstantName] = JSON.parse(newModuleEndpoints);

  let endpointsTsContent =
    `// Auto-generated by swagger-to-ddd\n` +
    `// This file is overwritten on each generation run for the specified module.\n` +
    `// Manual changes to other modules might be lost.\n` +
    `const BASE_URL = \"${baseUrl}\";\n\n` +
    `export const endpoints = {\n`;

  for (const [constName, moduleEndpoints] of Object.entries(currentEndpoints)) {
    endpointsTsContent += `  ${constName}: {\n`;
    for (const [endName, endPath] of Object.entries(moduleEndpoints)) {
      if (typeof endPath === "string" && endPath.startsWith("(")) {
        // This is a function endpoint
        endpointsTsContent += `    ${endName}: ${endPath},\n`;
      } else if (
        typeof endPath === "string" &&
        endPath.includes("${BASE_URL}")
      ) {
        endpointsTsContent += `    ${endName}: ${endPath},\n`;
      } else {
        endpointsTsContent += `    ${endName}: \`\${BASE_URL}${endPath}\`,\n`;
      }
    }
    endpointsTsContent += `  },\n`;
  }
  endpointsTsContent += `};\n`;

  const finalContent = await formatCode(endpointsTsContent, "typescript");
  await fs.writeFile(endpointFilePath, finalContent);
}

function generateModuleEndpointsSwagger(moduleName, swaggerJson, baseUrl) {
  const paths = swaggerJson.paths || {};
  const basePath = swaggerJson.basePath || "";
  const moduleConstantName = moduleName.toUpperCase();
  let endpointDefinitions = {};

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
          const httpMethod = method.toUpperCase();
          const operationId =
            operation.operationId ||
            `${httpMethod}_${pathUrl.replace(/\//g, "_").replace(/\{|\}/g, "")}`;

          // Convert to UPPER_SNAKE_CASE for endpoint constant names
          // e.g., uploadFile -> UPLOAD_FILE, addPet -> ADD_PET
          const endpointNameSuffix = operationId
            .replace(new RegExp(moduleName, "i"), "") // Remove module name part
            .replace(/([a-z])([A-Z])/g, "$1_$2") // Add underscore before capital letters
            .replace(/^_+|_+$/g, "") // Remove leading/trailing underscores
            .toUpperCase(); // Convert to uppercase

          // Ensure the suffix is not empty, if operationId was just the module name
          const finalEndpointName =
            endpointNameSuffix || `${httpMethod}_ENDPOINT`;

          const allParams = operation.parameters || [];
          const pathParams = allParams.filter((p) => p.in === "path");
          const queryParams = allParams.filter((p) => p.in === "query");

          // Create function signature parameters (path and query params)
          let paramNames = [];
          for (const param of allParams) {
            if (param.in === "path" || param.in === "query") {
              const isOptional = !param.required;
              const paramType = mapSwaggerTypeToTs(
                param,
                swaggerJson.definitions || {}
              );
              // Use original swagger param name for the function signature
              paramNames.push(
                `${param.name}${isOptional ? "?" : ""}: ${paramType}`
              );
            }
          }

          // Create path template with BASE_URL
          let pathTemplate = pathUrl;
          if (pathParams.length > 0) {
            for (const param of pathParams) {
              const regex = new RegExp(`\\{${param.name}\\}`, "g");
              pathTemplate = pathTemplate.replace(regex, `\${${param.name}}`);
            }
          }

          // Create query string part
          let queryString = "";
          if (queryParams.length > 0) {
            // Query params will be passed as an object to the request function,
            // so they don't need to be part of the URL template function here.
            // The URL template function should only handle path params.
          }

          // Create function body for the endpoint URL generator
          // If there are query params, they will be handled by the request options object
          const functionBody = `return \`\${BASE_URL}${pathTemplate}\`;`;
          const functionSignature = `(${paramNames.join(", ")}) => { ${functionBody} }`;

          endpointDefinitions[finalEndpointName] = functionSignature;
        }
      }
    }
  }

  if (Object.keys(endpointDefinitions).length === 0) {
    console.warn(
      `No endpoints found for module '${moduleName}' in Swagger paths.`
    );
  }

  // Convert to JSON-safe format for stringification
  const stringifiedEndpoints = {};
  for (const [key, value] of Object.entries(endpointDefinitions)) {
    stringifiedEndpoints[key] = value;
  }

  return JSON.stringify(stringifiedEndpoints, null, 2);
}

function camelize(str) {
  return str.replace(/([-_][a-z])/g, (group) =>
    group.toUpperCase().replace("-", "").replace("_", "")
  );
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}
