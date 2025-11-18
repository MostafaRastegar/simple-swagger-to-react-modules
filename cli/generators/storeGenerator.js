const { ensureDirectoryExists } = require("../utils");
const { formatCode } = require("../utils");

// Function to generate store management files
async function generateStoreFiles(moduleOutputDir, moduleName, swaggerJson) {
  const modelName = getModelNameFromSwagger(swaggerJson, moduleName);
  const moduleCamelCase =
    moduleName.charAt(0).toLowerCase() + moduleName.slice(1);

  // Generate store file in modules directory
  const storeContent = generateStoreFile(modelName, moduleCamelCase);
  const storePath = `${moduleOutputDir}/${moduleCamelCase}.store.ts`;
  await require("fs").promises.writeFile(storePath, storeContent);
  console.log(`Generated: ${storePath}`);
}

// Generate store file
function generateStoreFile(modelName, moduleCamelCase) {
  return `import createStore from 'react-constore';
import { ${modelName} } from './domains/models/${modelName}';

interface ${modelName}Store {
  selectedRowState: ${modelName}[];
  editModalOpen: boolean;
  addModalOpen: boolean;
  deleteModalOpen: boolean;
  repeatAdd: boolean;
  store_id: string;
}

export const ${moduleCamelCase}Store = createStore<${modelName}Store>({
  selectedRowState: [],
  editModalOpen: false,
  addModalOpen: false,
  deleteModalOpen: false,
  repeatAdd: false,
  store_id: '',
});
`;
}

// Get model name from swagger definitions
function getModelNameFromSwagger(swaggerJson, moduleName) {
  const definitions = swaggerJson.definitions || {};
  const definitionKeys = Object.keys(definitions);

  // First try to find a model that matches the module name
  const moduleModel = definitionKeys.find((key) => {
    const keyLower = key.toLowerCase();
    const moduleLower = moduleName.toLowerCase();
    return keyLower.includes(moduleLower) || moduleLower.includes(keyLower);
  });

  if (moduleModel) {
    return moduleModel;
  }

  // Fallback to existing logic
  const mainModel = definitionKeys.find((key) => {
    const keyLower = key.toLowerCase();
    return (
      keyLower.includes("category") ||
      keyLower.includes("pet") ||
      keyLower.includes("user") ||
      keyLower.includes("order") ||
      keyLower === key.toLowerCase()
    );
  });

  return mainModel || "Entity";
}

module.exports = {
  generateStoreFiles,
};
