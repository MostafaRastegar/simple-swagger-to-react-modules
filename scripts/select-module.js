#!/usr/bin/env node

const fs = require("fs").promises;
const path = require("path");
const { execSync } = require("child_process");

/**
 * Extract unique module names from operation tags in swagger.json
 * @param {object} swaggerJson - The parsed swagger.json content
 * @returns {string[]} - Array of unique module names
 */
function extractModulesFromTags(swaggerJson) {
  const moduleSet = new Set();

  if (swaggerJson.paths) {
    Object.values(swaggerJson.paths).forEach((pathObj) => {
      Object.values(pathObj).forEach((operation) => {
        if (operation.tags && Array.isArray(operation.tags)) {
          operation.tags.forEach((tag) => {
            // Filter out common non-module tags
            if (!["pet", "store", "user"].includes(tag.toLowerCase())) {
              moduleSet.add(tag);
            }
          });
        }
      });
    });
  }

  return Array.from(moduleSet).sort();
}

async function getAvailableModules() {
  try {
    // Read swagger.json
    const swaggerPath = path.join(__dirname, "..", "swagger.json");
    const swaggerContent = await fs.readFile(swaggerPath, "utf-8");
    const swagger = JSON.parse(swaggerContent);

    // Extract modules from operation tags (not root tags)
    const moduleNames = extractModulesFromTags(swagger);

    // Convert to format expected by the display function
    const modules = moduleNames.map((name) => ({
      name: name,
      description: `Operations tagged with '${name}'`,
    }));

    return modules;
  } catch (error) {
    console.error("Error reading swagger.json:", error.message);
    process.exit(1);
  }
}

async function displayModules(modules) {
  console.log("\n🔍 Available modules in swagger.json:\n");
  modules.forEach((module, index) => {
    console.log(
      `${index < 9 ? "0" + (index + 1).toString() : index + 1}. ${module.name}`
    );
    // console.log(`   ${module.description}`);
    // console.log("");
  });
  console.log("0. Exit");
  console.log("");
}

async function getUserSelection() {
  return new Promise((resolve) => {
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("Please select a module number: ", (answer) => {
      rl.close();
      resolve(parseInt(answer));
    });
  });
}

async function runExportCommand(moduleName, inputTagName) {
  try {
    console.log(`\n🚀 Running export command for module: ${moduleName}`);
    console.log(`Command: npm run export --tag ${inputTagName}\n`);

    // Use the provided tag name
    const tagName = inputTagName;

    // Run the export command
    const command = `npm run export --tag ${tagName}`;
    console.log(`Executing: ${command}`);

    execSync(command, {
      stdio: "inherit",
      cwd: path.join(__dirname, ".."),
    });

    console.log(`\n✅ Successfully generated module: ${moduleName}`);
  } catch (error) {
    console.error(`\n❌ Error running export command:`, error.message);
    process.exit(1);
  }
}

async function main() {
  console.log("🎯 Swagger to Modules - Interactive Module Generator");
  console.log("==================================================");

  const modules = await getAvailableModules();

  if (modules.length === 0) {
    console.log("❌ No modules found in swagger.json");
    process.exit(1);
  }

  await displayModules(modules);
  const selection = await getUserSelection();

  if (selection === 0) {
    console.log("👋 Goodbye!");
    process.exit(0);
  }

  if (selection < 1 || selection > modules.length) {
    console.log("❌ Invalid selection. Please run the script again.");
    process.exit(1);
  }

  const selectedModule = modules[selection - 1];
  console.log(`\n✅ Selected module: ${selectedModule.name}`);

  // Get tag name (module name by default, or from command line argument)
  const tagName = process.argv[2] || selectedModule.name;

  await runExportCommand(selectedModule.name, tagName);
}

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
