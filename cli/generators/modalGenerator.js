const { ensureDirectoryExists } = require("../utils");

async function generateModalComponents(
  moduleOutputDir,
  moduleName,
  swaggerJson
) {
  const moduleCamelCase =
    moduleName.charAt(0).toLowerCase() + moduleName.slice(1);

  const componentsDir = moduleOutputDir
    .replace("/modules/", "/app/")
    .replace(`/modules/${moduleName}`, `/${moduleName}/_components`);
  await ensureDirectoryExists(componentsDir);

  // Simple AddModal
  const addModalPath = `${componentsDir}/AddModal.tsx`;
  await require("fs").promises.writeFile(
    addModalPath,
    `// AddModal for ${moduleName}\n`
  );
  console.log(`Generated: ${addModalPath}`);

  // Simple EditModal
  const editModalPath = `${componentsDir}/EditModal.tsx`;
  await require("fs").promises.writeFile(
    editModalPath,
    `// EditModal for ${moduleName}\n`
  );
  console.log(`Generated: ${editModalPath}`);

  // Simple DeleteModal
  const deleteModalPath = `${componentsDir}/DeleteModal.tsx`;
  await require("fs").promises.writeFile(
    deleteModalPath,
    `// DeleteModal for ${moduleName}\n`
  );
  console.log(`Generated: ${deleteModalPath}`);

  // Simple ModalFooter
  const modalFooterPath = `${componentsDir}/ModalFooter.tsx`;
  await require("fs").promises.writeFile(
    modalFooterPath,
    `// ModalFooter for ${moduleName}\n`
  );
  console.log(`Generated: ${modalFooterPath}`);
}

function getModelNameFromSwagger(swaggerJson) {
  const definitions = swaggerJson.definitions || {};
  const definitionKeys = Object.keys(definitions);

  const mainModel = definitionKeys.find((key) => {
    const keyLower = key.toLowerCase();
    return (
      keyLower.includes("pet") ||
      keyLower.includes("user") ||
      keyLower.includes("order") ||
      keyLower === key.toLowerCase()
    );
  });

  return mainModel || "Entity";
}

module.exports = {
  generateModalComponents,
};
