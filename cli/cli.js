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
