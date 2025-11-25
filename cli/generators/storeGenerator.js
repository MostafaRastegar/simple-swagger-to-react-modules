const { ensureDirectoryExists } = require("../utils");
const { formatCode } = require("../utils");

// Function to generate store management files
async function generateStoreFiles(moduleOutputDir, moduleName, swaggerJson) {
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

    // Filter to get only the main entity models (exclude request types and non-entity types)
    const entityModels = importedTypes.filter((typeName) => {
      const typeLower = typeName.toLowerCase();
      return (
        !typeLower.endsWith("request") &&
        !typeLower.includes("paginated") &&
        !typeLower.includes("categoriesresponse") &&
        !typeLower.includes("categoriescreateparams") &&
        // Exclude models that are not used as primary entities in CRUD operations
        // (keep models that are traditionally used as entities like Category, Product, etc.)
        /^[A-Z][a-zA-Z]*$/.test(typeName) && // Must be camelCase starting with capital
        !typeLower.includes("categories") // Exclude generic aggregated types like 'Categories'
      );
    });

    // Remove duplicates and ensure we only have the core entities
    const uniqueModels = [...new Set(entityModels)];

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
};
