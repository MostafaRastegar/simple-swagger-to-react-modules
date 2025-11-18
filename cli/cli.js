#!/usr/bin/env node

const { Command } = require("commander");
const fs = require("fs").promises;
const path = require("path");

const { ensureDirectoryExists } = require("./utils");

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
      console.log(
        "[DEBUG] CLI Loaded swaggerJson.components.schemas keys:",
        swaggerJson.components?.schemas
          ? Object.keys(swaggerJson.components.schemas)
          : "undefined"
      );

      const moduleOutputDir = path.join(
        process.cwd(),
        options.outputDir,
        options.moduleName
      );
      const domainsDir = path.join(moduleOutputDir, "domains");
      const modelsDir = path.join(domainsDir, "models");
      const constantsDir = path.join(process.cwd(), "src", "constants");

      await ensureDirectoryExists(modelsDir);
      await ensureDirectoryExists(domainsDir);
      try {
        await ensureDirectoryExists(constantsDir);
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
      await generateModelFiles(modelsDir, options.moduleName, swaggerJson);

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

      // 5. Generate store management
      console.log("Generating store files...");
      await generateStoreFiles(
        moduleOutputDir,
        options.moduleName,
        swaggerJson
      );

      // 6. Generate app routes and UI components
      console.log("Generating app routes and UI components...");
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

      // 7. Update or create endpoints.ts
      console.log("Updating/Creating endpoints.ts...");
      await updateEndpointsFile(
        constantsDir,
        options.moduleName,
        swaggerJson,
        options.baseUrl
      );

      console.log(
        `Successfully generated complete DDD module with UI for '${options.moduleName}'!`
      );
      console.log("Generated files:");
      console.log(`  - Domain models: ${modelsDir}`);
      console.log(`  - Service layer: ${moduleOutputDir}`);
      console.log(
        `  - App routes: ${moduleOutputDir.replace("/modules/", "/app/").replace(`/modules/${options.moduleName}`, `/${options.moduleName}`)}`
      );
      console.log(
        `  - UI components: ${moduleOutputDir.replace("/modules/", "/app/").replace(`/modules/${options.moduleName}`, `/${options.moduleName}/_components`)}`
      );
    } catch (error) {
      console.error("Error generating module:", error);
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
        console.log(
          "Please run 'npm run generate' first to create the module structure."
        );
        process.exit(1);
      }

      // Load swagger.json for context
      const swaggerContent = await fs.readFile("./swagger.json", "utf-8");
      const swaggerJson = JSON.parse(swaggerContent);

      // Generate UI components
      console.log("Generating app routes and UI components...");
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

program.parse();
