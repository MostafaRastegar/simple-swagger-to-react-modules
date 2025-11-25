#!/usr/bin/env node

const { Command } = require("commander");
const fs = require("fs").promises;
const path = require("path");

const { ensureDirectoryExists } = require("./utils");

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

const { generateModelFiles } = require("./generators/modelGenerator");

const {
  generateServiceInterface,
  generateServiceImplementation,
} = require("./generators/serviceGenerator");

const {
  generatePresentationHooks,
} = require("./generators/presentationGenerator");

const { updateEndpointsFile } = require("./generators/endpointGenerator");

// New imports for app route generation
const { generateAppRouteFile } = require("./generators/appRouteGenerator");
const { generateModalComponents } = require("./generators/modalGenerator");
const { generateStoreFiles } = require("./generators/storeGenerator");

const program = new Command();

program
  .name("swagger-to-ddd")
  .description(
    "CLI to generate DDD modules from Swagger JSON with UI integration"
  )
  .version("1.0.0");

program
  .command("generate")
  .alias("g")
  .description("Generate DDD module(s) from swagger.json")
  .requiredOption("-i, --input <file>", "Input Swagger JSON file path")
  .option(
    "-m, --module-name <name>",
    "Name of specific module to generate (if not provided, all modules will be detected and generated)"
  )
  .requiredOption(
    "-o, --output-dir <dir>",
    "Output directory for the module(s) (e.g., src/modules)"
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

      // If no specific module is provided, auto-detect all modules
      const modulesToGenerate = options.moduleName
        ? [options.moduleName]
        : extractModulesFromTags(swaggerJson);

      if (modulesToGenerate.length === 0) {
        console.error("No modules found to generate!");
        console.error(
          "Either provide a specific module name with -m, or make sure operations have proper 'tags' arrays."
        );
        process.exit(1);
      }

      console.log(
        `Will generate ${modulesToGenerate.length} module(s):`,
        modulesToGenerate.join(", ")
      );

      const constantsDir = path.join(process.cwd(), "src", "constants");
      try {
        await ensureDirectoryExists(constantsDir);
      } catch (mkdirErr) {
        if (mkdirErr.code !== "EEXIST") {
          throw mkdirErr;
        }
      }

      // Generate each module
      for (const moduleName of modulesToGenerate) {
        const moduleOutputDir = path.join(
          process.cwd(),
          options.outputDir,
          moduleName
        );
        const domainsDir = path.join(moduleOutputDir, "domains");
        const modelsDir = path.join(domainsDir, "models");

        await ensureDirectoryExists(modelsDir);
        await ensureDirectoryExists(domainsDir);

        await generateModelFiles(modelsDir, moduleName, swaggerJson);

        await generateServiceInterface(
          domainsDir,
          moduleName,
          swaggerJson,
          options.baseUrl
        );

        await generateServiceImplementation(
          moduleOutputDir,
          moduleName,
          swaggerJson,
          options.baseUrl
        );

        await generatePresentationHooks(
          moduleOutputDir,
          moduleName,
          swaggerJson
        );

        await generateStoreFiles(moduleOutputDir, moduleName, swaggerJson);

        await generateAppRouteFile(moduleOutputDir, moduleName, swaggerJson);

        await generateModalComponents(moduleOutputDir, moduleName, swaggerJson);

        await updateEndpointsFile(
          constantsDir,
          moduleName,
          swaggerJson,
          options.baseUrl
        );
      }

      console.log(
        `\n🎉 All ${modulesToGenerate.length} module(s) generated successfully!`
      );
      console.log("Run 'npm run list-modules' to see available modules.");
    } catch (error) {
      console.error("Error generating module(s):", error);
      process.exit(1);
    }
  });

program
  .command("ui")
  .description("Generate only UI components and app routes for existing module")
  .requiredOption(
    "-m, --module-name <name>",
    "Name of the existing module (e.g., pet, user)"
  )
  .requiredOption(
    "-o, --output-dir <dir>",
    "Output directory for the module (e.g., src/modules)"
  )
  .action(async (options) => {
    try {
      console.log(
        `Generating UI components for module '${options.moduleName}'...`
      );

      const moduleOutputDir = path.join(
        process.cwd(),
        options.outputDir,
        options.moduleName
      );

      // Check if module exists
      try {
        await fs.access(moduleOutputDir);
      } catch (error) {
        console.error(
          `Module '${options.moduleName}' not found at ${moduleOutputDir}`
        );
        console.error(
          "Please run 'npm run generate' first to create the module structure."
        );
        process.exit(1);
      }

      // Load swagger.json for context
      const swaggerContent = await fs.readFile("./swagger.json", "utf-8");
      const swaggerJson = JSON.parse(swaggerContent);

      // Generate UI components
      await generateAppRouteFile(
        moduleOutputDir,
        options.moduleName,
        swaggerJson
      );

      await generateModalComponents(
        moduleOutputDir,
        options.moduleName,
        swaggerJson
      );

      console.log(
        `Successfully generated UI components for '${options.moduleName}'!`
      );
    } catch (error) {
      console.error("Error generating UI components:", error);
      process.exit(1);
    }
  });

// New command to list available modules from swagger tags
program
  .command("list-modules")
  .alias("lm")
  .description(
    "List all available modules found in swagger.json operation tags"
  )
  .option(
    "-i, --input <file>",
    "Input Swagger JSON file path",
    "./swagger.json"
  )
  .action(async (options) => {
    try {
      console.log(`Reading Swagger file from: ${options.input}`);
      const swaggerContent = await fs.readFile(options.input, "utf-8");
      const swaggerJson = JSON.parse(swaggerContent);

      const modules = extractModulesFromTags(swaggerJson);

      if (modules.length === 0) {
        console.log("No modules found in swagger.json operation tags.");
        console.log("Make sure your operations have proper 'tags' arrays.");
        return;
      }

      console.log(`Found ${modules.length} module(s) in swagger.json:`);
      modules.forEach((module, index) => {
        console.log(`  ${index + 1}. ${module}`);
      });

      console.log("\nTo generate any module, run:");
      modules.forEach((module) => {
        console.log(`  npm run export --tag ${module}`);
      });
    } catch (error) {
      console.error("Error listing modules:", error);
      process.exit(1);
    }
  });

program.parse();
