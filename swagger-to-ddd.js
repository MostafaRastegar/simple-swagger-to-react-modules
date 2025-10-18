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
    path.join(modelsDir, `${moduleName.toLowerCase()}.ts`),
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
  const responseDtoName = `${modelName}Response`;

  let methodsTs = "";
  const paths = swaggerJson.paths || {};
  const basePath = swaggerJson.basePath || "";
  const mainModelName = modelName;

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
          const bodyParam = allParams.find((p) => p.in === "body");

          // Handle path and query parameters
          for (const param of allParams) {
            if (param.in === "path" || param.in === "query") {
              const paramType = mapSwaggerTypeToTs(
                param,
                swaggerJson.definitions || {}
              );
              const isOptional = !param.required;
              paramsTs += `${param.name}${isOptional ? "?" : ""}: ${paramType}, `;
            }
          }

          // Handle body parameter
          if (bodyParam) {
            const bodyType = mapSwaggerTypeToTs(
              bodyParam.schema,
              swaggerJson.definitions || {}
            );
            paramsTs += `body: ${bodyType}, `;
          }

          // Remove trailing comma and space
          if (paramsTs.endsWith(", ")) {
            paramsTs = paramsTs.slice(0, -2);
          }

          let returnType = "Promise<any>";
          const successResponse =
            operation.responses["200"]?.schema ||
            operation.responses.default?.schema;

          if (successResponse) {
            const resolvedType = mapSwaggerTypeToTs(
              successResponse,
              swaggerJson.definitions || {}
            );
            // If it's an array, the service might return an array of items
            if (successResponse.type === "array") {
              returnType = `Promise<Array<${resolvedType}>>`;
            } else {
              returnType = `Promise<${resolvedType}>`;
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
    `import { ${requestDtoName}, ${mainModelName} } from './models/${moduleName}';\n` +
    `// Assuming ${responseDtoName} might be used for wrapped responses, adjust if needed\n` +
    `// import { ${responseDtoName} } from './models/${moduleName}';\n\n` +
    `export interface ${interfaceName} {\n${methodsTs}}\n`;
  const finalContent = await formatCode(content);
  await fs.writeFile(
    path.join(domainsDir, `I${moduleName}.service.ts`),
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
          const methodName = camelize(
            operationId.replace(new RegExp(moduleName, "i"), "")
          );

          const allParams = operation.parameters || [];
          const pathParams = allParams.filter((p) => p.in === "path");
          const queryParams = allParams.filter((p) => p.in === "query");
          const bodyParam = allParams.find((p) => p.in === "body");

          let paramSignature = "";
          const paramNames = [];

          for (const param of allParams) {
            if (param.in === "path" || param.in === "query") {
              const paramType = mapSwaggerTypeToTs(param, allDefinitions);
              const isOptional = !param.required;
              paramSignature += `${param.name}${isOptional ? "?" : ""}: ${paramType}, `;
              paramNames.push(param.name);
            }
          }

          if (bodyParam) {
            const bodyType = mapSwaggerTypeToTs(
              bodyParam.schema,
              allDefinitions
            );
            paramSignature += `body: ${bodyType}, `;
            paramNames.push("body");
          }

          // Remove trailing comma and space
          if (paramSignature.endsWith(", ")) {
            paramSignature = paramSignature.slice(0, -2);
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
          if (method === "get" || method === "delete") {
            requestCall = `request.${method}(endpoints.${moduleName.toUpperCase()}.${methodName}(${paramNames.join(", ")}))`;
          } else if (method === "post" || method === "put") {
            requestCall = `request.${method}(endpoints.${moduleName.toUpperCase()}.${methodName}(${paramNames.filter((p) => p !== "body").join(", ")}), body)`;
          }

          if (authRequired) {
            serviceMethodsTs += `  ${methodName}: (${paramSignature}) =>\n      serviceHandler<${mainModelName}>(() => ${requestCall}),\n`;
          } else {
            serviceMethodsTs += `  ${methodName}: (${paramSignature}) =>\n      serviceHandler<${mainModelName}>(() => requestWithoutAuth.${method}(endpoints.${moduleName.toUpperCase()}.${methodName}(${paramNames.filter((p) => p !== "body").join(", ")}), body)),\n`;
          }
        }
      }
    }
  }

  if (!serviceMethodsTs) {
    serviceMethodsTs = "    // No methods implemented for service\n";
  }

  const content =
    `import { ${interfaceName} } from './domains/I${moduleName}.service';\n` +
    `import { ${mainModelName}, ${mainModelName}CreateParams } from './domains/models/${moduleName}';\n` +
    `import { endpoints } from '../constants/endpoints';\n` +
    `import { serviceHandler, request, requestWithoutAuth } from '../../utils/request';\n\n` +
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

  let hookMethodsTs = "";
  const paths = swaggerJson.paths || {};
  const basePath = swaggerJson.basePath || "";
  const mainModelName = modelName;

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
          const hookName = `use${camelize(operationId.replace(new RegExp(moduleName, "i"), "")).replace(/^./, (str) => str.toUpperCase())}`;
          const methodName = camelize(
            operationId.replace(new RegExp(moduleName, "i"), "")
          );
          const isMutation = !["get", "delete"].includes(method);

          let hookFn = isMutation ? "useMutation" : "useQuery";
          let hookParams = "";

          if (isMutation) {
            let serviceCallArgs = [];
            const allParams = operation.parameters || [];

            for (const param of allParams) {
              if (param.in === "path" || param.in === "query") {
                serviceCallArgs.push(`variables.${param.name}`);
              } else if (param.in === "body") {
                serviceCallArgs.push(`variables.body`);
              }
            }

            const serviceCall = `${serviceName.toLowerCase()}.${methodName}(${serviceCallArgs.join(", ")})`;
            const mutationFnString = `mutationFn: () => ${serviceCall}`;
            const onSuccessString = "onSuccess";
            const onErrorString = "onError";
            hookParams = `{ ${mutationFnString}, ${onSuccessString}, ${onErrorString} }`;

            hookMethodsTs +=
              `  ${hookName}: (variables: any, onSuccess?: (data: any) => void, onError?: (error: any) => void) => \n` +
              `    useMutation(${hookParams}),\n`;
          } else {
            let queryKey = `['${moduleName}', '${methodName}'`;
            const allParams = operation.parameters || [];
            const queryArgs = [];

            for (const param of allParams) {
              if (param.in === "path" || param.in === "query") {
                queryKey += `, variables.${param.name}`;
                queryArgs.push(`variables.${param.name}`);
              }
            }
            queryKey += "]";
            const args = queryArgs.join(", ");
            const queryFn = `queryFn: () => ${serviceName.toLowerCase()}.${methodName}(${args})`;

            let enabled = "enabled: true";
            if (allParams.some((p) => p.in === "path" || p.in === "query")) {
              enabled = `enabled: Object.keys(variables || {}).length > 0`;
            }
            hookParams = `{ queryKey: ${queryKey}, ${queryFn}, ${enabled} }`;

            hookMethodsTs +=
              `  ${hookName}: (variables: any) => \n` +
              `    useQuery<${mainModelName}[]>(${hookParams}),\n`;
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
    `// import { useRouter } from 'next/navigation';\n\n` +
    `const ${serviceName.toLowerCase()} = ${serviceName}();\n\n` +
    `export function ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Presentation() {\n` +
    `  return {\n${hookMethodsTs}\n  };\n` +
    `}\n`;
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
          const endpointName = camelize(
            operationId.replace(new RegExp(moduleName, "i"), "")
          );

          const allParams = operation.parameters || [];
          const pathParams = allParams.filter((p) => p.in === "path");
          const queryParams = allParams.filter((p) => p.in === "query");

          // Create function signature
          let paramNames = [];
          for (const param of allParams) {
            if (param.in === "path" || param.in === "query") {
              const isOptional = !param.required;
              paramNames.push(`${param.name}${isOptional ? "?" : ""}`);
            }
          }

          // Create path template
          let pathTemplate = pathUrl;
          if (pathParams.length > 0) {
            for (const param of pathParams) {
              const regex = new RegExp(`\\{${param.name}\\}`, "g");
              pathTemplate = pathTemplate.replace(regex, `\${${param.name}}`);
            }
          }

          // Create query string
          let queryString = "";
          if (queryParams.length > 0) {
            const queryParts = queryParams.map(
              (p) => `${p.name}=\${${p.name}}`
            );
            queryString = `?${queryParts.join("&")}`;
          }

          // Create function body
          const functionBody = `return \`\${BASE_URL}${pathTemplate}${queryString}\`;`;
          const functionSignature = `(${paramNames.join(", ")}) => { ${functionBody} }`;

          endpointDefinitions[endpointName] = functionSignature;
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
