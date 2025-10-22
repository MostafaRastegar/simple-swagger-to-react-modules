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

          // Generate proper types for variables
          let variableProps = "";
          let formDataInterfaceNameForOperation = null;
          for (const param of allParams) {
            if (param.in === "path" || param.in === "query") {
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
              } else if (bodyType === mainModelName) {
                bodyTypeName = `${mainModelName}CreateParams`;
              } else {
                bodyTypeName = `${mainModelName}CreateParams`;
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
          variablesType = `{ ${variableProps} }`;

          const serviceCall = `Service.${originalMethodName}(${serviceCallArgs.join(", ")})`;

          if (isMutation) {
            const mutationFnString = `mutationFn: () => ${serviceCall}`;
            const onSuccessString = "onSuccess";
            const onErrorString = "onError";
            hookParams = `{ ${mutationFnString}, ${onSuccessString}, ${onErrorString} }`;

            hookMethodsTs +=
              `    ${hookName}: (variables: ${variablesType}, onSuccess?: (data: any) => void, onError?: (error: any) => void) => \n` +
              `      useMutation(${hookParams}),\n`;
          } else {
            let queryKeyArray = `[${moduleName}QueryKeys.`;
            const queryKeySuffix = originalMethodName
              .replace(/([A-Z])/g, "_$1")
              .toUpperCase();
            queryKeyArray += `${queryKeySuffix}`;

            const pathQueryParams = allParams.filter(
              (p) => p.in === "path" || p.in === "query"
            );
            if (pathQueryParams.length > 0) {
              queryKeyArray += `, ${pathQueryParams.map((p) => `JSON.stringify(variables.${p.name})`).join(", ")}`;
            }
            queryKeyArray += `]`;

            const queryFnString = `queryFn: () => ${serviceCall}`;

            let enabledCondition = "enabled: true";
            if (
              pathQueryParams.length > 0 ||
              allParams.some((p) => p.in === "body")
            ) {
              const requiredParamNames = allParams
                .filter((p) => p.required)
                .map((p) => `variables.${p.name}`);
              if (requiredParamNames.length > 0) {
                enabledCondition = `enabled: ${requiredParamNames.join(" && ")}`;
              } else if (allParams.length > 0) {
                enabledCondition = `enabled: Object.keys(variables || {}).length > 0`;
              }
            }

            hookParams = `{ queryKey: ${queryKeyArray}, ${queryFnString}, ${enabledCondition} }`;

            let queryGenericType = mainModelName;
            const successResponse = operation.responses["200"]?.schema;
            if (successResponse && successResponse.type === "array") {
              queryGenericType = `Array<${mainModelName}>`;
            }

            hookMethodsTs +=
              `    ${hookName}: (variables: ${variablesType}) => \n` +
              `      useQuery(${hookParams}),\n`;
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

  const content =
    `${formDataImports}` +
    `import { ${serviceName} } from './${moduleDirName}.service';\n` +
    `import { useQuery, useMutation } from '@tanstack/react-query';\n` +
    `import { useParams } from 'next/navigation';\n\n` +
    `${queryKeysTs}` +
    `// PRESENTATION LAYER\n` +
    `// React Query hooks for ${moduleName}\n` +
    `function ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Presentation() {\n` +
    `  const Service = ${serviceName}();\n` +
    `  return {\n${hookMethodsTs}\n  };\n` +
    `}\n\n` +
    `export { ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Presentation };\n`;
  const finalContent = await formatCode(content, "typescript");
  await fs.writeFile(
    path.join(moduleOutputDir, `${moduleDirName}.presentation.ts`),
    finalContent
  );
}

module.exports = {
  generatePresentationHooks,
};
