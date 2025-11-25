const { ensureDirectoryExists } = require("../utils");
const { formatCode } = require("../utils");

// Function to generate store management files
async function generateStoreFiles(moduleOutputDir, moduleName, swaggerJson) {
  // Check if the module meets the criteria for store generation
  const shouldGenerateStores = checkStoreRequirements(moduleName, swaggerJson);

  if (
    !shouldGenerateStores.hasList ||
    (!shouldGenerateStores.hasUpdate && !shouldGenerateStores.hasDelete)
  ) {
    console.log(
      `Skipping store generation for '${moduleName}' - missing required list + update/delete operations`
    );
    console.log(`  - Has list operation: ${shouldGenerateStores.hasList}`);
    console.log(`  - Has update operation: ${shouldGenerateStores.hasUpdate}`);
    console.log(`  - Has delete operation: ${shouldGenerateStores.hasDelete}`);
    return;
  }

  console.log(
    `Generating stores for '${moduleName}' - meets criteria (list + update/delete operations)`
  );

  const modelNames = await getRelevantModelNamesFromGeneratedFiles(
    moduleOutputDir,
    moduleName
  );

  for (const modelName of modelNames) {
    const storeName = `${modelName.toLowerCase()}Store`;
    const storeContent = generateStoreFile(modelName, moduleName);
    const storePath = `${moduleOutputDir}/${modelName.toLowerCase()}.store.ts`;

    await require("fs").promises.writeFile(storePath, storeContent);
    console.log(`Generated: ${storePath}`);
  }
}

// Check if module has required operations for store generation
function checkStoreRequirements(moduleName, swaggerJson) {
  const paths = swaggerJson.paths || {};
  let hasList = false;
  let hasUpdate = false;
  let hasDelete = false;

  for (const [pathUrl, pathItem] of Object.entries(paths)) {
    const effectivePath = pathUrl.startsWith("/")
      ? pathUrl.substring(1)
      : pathUrl;
    const pathSegments = effectivePath.split("/");
    const relevantSegmentIndex = pathSegments.findIndex(
      (seg) => seg === moduleName
    );

    if (relevantSegmentIndex !== -1) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (["get", "post", "put", "delete"].includes(method)) {
          const httpMethod = method.toUpperCase();

          // Check for LIST operation (GET request returning arrays/collections)
          if (httpMethod === "GET") {
            // Consider it a list operation if it doesn't have path parameters (or has minimal path params)
            // or if the operationId contains 'list'
            const pathParams =
              operation.parameters?.filter((p) => p.in === "path") || [];
            const operationId = operation.operationId || "";

            if (
              pathParams.length === 0 ||
              operationId.toLowerCase().includes("list")
            ) {
              hasList = true;
            }
          }

          // Check for UPDATE operations (PUT/PATCH)
          if (httpMethod === "PUT" || httpMethod === "PATCH") {
            hasUpdate = true;
          }

          // Check for DELETE operations
          if (httpMethod === "DELETE") {
            hasDelete = true;
          }
        }
      }
    }
  }

  return { hasList, hasUpdate, hasDelete };
}

// Generate store file
function generateStoreFile(modelName, moduleName) {
  const storeName = `${modelName.toLowerCase()}Store`;
  return `import createStore from 'react-constore';
import { ${modelName} } from './domains/models/${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}';

interface ${modelName}Store {
  selectedRowState: ${modelName}[];
  editModalOpen: boolean;
  addModalOpen: boolean;
  deleteModalOpen: boolean;
}

export const ${storeName} = createStore<${modelName}Store>({
  selectedRowState: [],
  editModalOpen: false,
  addModalOpen: false,
  deleteModalOpen: false,
});
`;
}

// Get relevant model names that should have stores (models with CRUD operations)
function getRelevantModelNames(swaggerJson, moduleName) {
  const definitions = swaggerJson.definitions || {};
  const definitionKeys = Object.keys(definitions);
  const relevantModels = [];

  // Find models that are main entities (not requests/responses/lists)
  for (const key of definitionKeys) {
    const keyLower = key.toLowerCase();

    // Skip request/response types and list types
    if (
      keyLower.endsWith("request") ||
      keyLower.endsWith("response") ||
      keyLower.endsWith("list") ||
      keyLower.endsWith("create") ||
      keyLower.endsWith("update") ||
      keyLower.includes("paginated")
    ) {
      continue;
    }

    console.log(` Checking model: ${key}`);

    // Include models that relate to the module name or are standalone entities
    if (
      keyLower.includes(moduleName.toLowerCase()) ||
      moduleName.toLowerCase().includes(keyLower) ||
      keyLower === "category" ||
      keyLower === "categories" ||
      keyLower.includes("item") ||
      (keyLower.length > 2 && /^[A-Z][a-zA-Z]*$/.test(key)) // Word entities
    ) {
      relevantModels.push(key);
    }
  }

  // If no specific models found, look for the module name exactly
  if (relevantModels.length === 0) {
    const capitalizedModule =
      moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
    if (definitions[capitalizedModule]) {
      relevantModels.push(capitalizedModule);
    }
  }

  // Note: The main logic now happens in getRelevantModelNamesFromGeneratedFiles
  // which analyzes the actual generated files to determine models automatically

  // Remove duplicates
  return [...new Set(relevantModels)];
}

// Get relevant model names by analyzing imports in the service interface
async function getRelevantModelNamesFromGeneratedFiles(
  moduleOutputDir,
  moduleName
) {
  const fs = require("fs").promises;
  const path = require("path");

  const interfaceDir = path.join(moduleOutputDir, "domains");
  const interfaceFileName = `I${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Service.ts`;

  try {
    // Read the interface to find imported models
    const interfacePath = path.join(interfaceDir, interfaceFileName);
    const interfaceContent = await fs.readFile(interfacePath, "utf-8");

    // Extract imported models from the interface (excluding standard types)
    // Dynamic file path based on module name
    const dynamicImportRegex = new RegExp(
      `import\\s*\\{[^}]*\\}\\s*from\\s*['"]\\./models/${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}['"]`,
      "g"
    );
    const importMatch = dynamicImportRegex.exec(interfaceContent);

    if (!importMatch) {
      return [];
    }

    // Extract the types list from between the { and } brackets
    const importBlock = importMatch[0];
    const typesMatch = importBlock.match(/\{([\s\S]*?)\}/);

    if (!typesMatch) {
      return [];
    }

    const typesString = typesMatch[1];
    const importedTypes = [];

    // Split by comma and extract type names, handling multiline imports
    const typesList = typesString
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t && t !== "import" && t !== "from" && t !== "models");

    for (const typeName of typesList) {
      // Clean up type names (remove extra whitespace and quotes)
      const cleanTypeName = typeName.trim();

      // Include types that are not standard types
      if (
        cleanTypeName &&
        cleanTypeName !== "import" &&
        cleanTypeName !== "from" &&
        ![
          "PaginationParams",
          "PaginationList",
          "ResponseObject",
          "CategoriesCreateParams",
          "CategoriesResponse",
        ].includes(cleanTypeName)
      ) {
        importedTypes.push(cleanTypeName);
      }
    }

    // Filter to get only the main entity models (exclude request types, parameter types, and non-entity types)
    const entityModels = importedTypes.filter((typeName) => {
      const typeLower = typeName.toLowerCase();

      // Exclude parameter/request/response types
      if (
        typeLower.endsWith("request") ||
        typeLower.endsWith("response") ||
        typeLower.endsWith("params") ||
        typeLower.endsWith("createparams") ||
        typeLower.endsWith("queryparams") ||
        typeLower.endsWith("update") ||
        typeLower.includes("paginated") ||
        typeLower.includes("categoriesresponse") ||
        typeLower.includes("categoriescreateparams")
      ) {
        return false;
      }

      // Only keep models that are primary domain entities
      // Must be PascalCase (start with capital), represent real entities, not just data transfer types
      const isEntityPattern =
        /^[A-Z][a-zA-Z]*$/.test(typeName) && // PascalCase
        typeName.length > 2 && // Not too short
        !typeLower.includes("async") && // Not async-related
        !typeLower.includes("error") && // Not error types
        !typeLower.includes("result"); // Not result types

      // For modules like "categories", allow the plural form but not generic types
      const isAllowedPlural =
        moduleName.toLowerCase() + "s" === typeLower &&
        typeLower !== "categories";

      return isEntityPattern || isAllowedPlural;
    });

    // Resolve conflicts between singular and plural forms of the same entity
    // Prefer the plural form that matches the module name, or if module name matches singular, prefer that
    const deduplicatedModels = [];
    for (const model of entityModels) {
      let shouldAdd = true;

      for (const existingModel of deduplicatedModels) {
        const modelLower = model.toLowerCase();
        const existingLower = existingModel.toLowerCase();
        const moduleLower = moduleName.toLowerCase();

        // If one is singular form of another (e.g., category/categories, stuff/stuffs)
        if (
          modelLower === existingLower + "s" ||
          existingLower === modelLower + "s"
        ) {
          // Check if current model matches module name
          const modelMatchesModule =
            modelLower === moduleLower || modelLower === moduleLower + "s";

          const existingMatchesModule =
            existingLower === moduleLower ||
            existingLower === moduleLower + "s";

          if (modelMatchesModule && !existingMatchesModule) {
            // Remove existing and add current instead
            const index = deduplicatedModels.indexOf(existingModel);
            deduplicatedModels.splice(index, 1);
            shouldAdd = true;
          } else if (
            existingMatchesModule ||
            (!modelMatchesModule && !existingMatchesModule)
          ) {
            // Keep existing, don't add current (prefer existing or longer/plural form)
            shouldAdd = false;
          }
          break;
        }
      }

      if (shouldAdd) {
        deduplicatedModels.push(model);
      }
    }

    // Remove duplicates and ensure we only have the core entities
    const uniqueModels = [...new Set(deduplicatedModels)];

    return uniqueModels;
  } catch (error) {
    console.error(
      `[DEBUG] Error analyzing interface imports: ${error.message}`
    );
    return [];
  }
}

module.exports = {
  generateStoreFiles,
  checkStoreRequirements,
};
