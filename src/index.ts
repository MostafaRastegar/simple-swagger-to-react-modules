#!/usr/bin/env node

const { Command } = require("commander");
const path = require("path");
const fs = require("fs-extra");
const dotenv = require("dotenv");
const LLMGenerator =
  require("./generator/llm-generator").default ||
  require("./generator/llm-generator");
const FileWriter =
  require("./writer/file-writer").default || require("./writer/file-writer");
const { parseSwagger } = require("./parser/swagger-parser");

// Load environment variables from .env file
dotenv.config();

// Import global types
import type {
  ParsedSwaggerData,
  SwaggerOperation,
  SwaggerPathItem,
} from "./global-types";

const program = new Command();

program
  .name("swagger-to-modules")
  .description(
    "Generates frontend modules from a Swagger JSON file using an LLM."
  )
  .version("1.0.0");

program
  .command("generate")
  .alias("g")
  .description("Generate frontend modules from a Swagger file.")
  .argument("<swagger-file>", "Path to the Swagger JSON file.")
  .option(
    "-o, --output <dir>",
    "Output directory for generated code",
    "generated-frontend"
  )
  .option(
    "-m, --model <model>",
    "LLM model to use (e.g., z-ai/glm-4.5-air:free)",
    "z-ai/glm-4.5-air:free"
  )
  .option(
    "-k, --api-key <key>",
    "OpenRouter API key (or set OPENROUTER_API_KEY env var)"
  )
  .action(
    async (
      swaggerFile: string,
      options: { output: string; model: string; apiKey?: string }
    ) => {
      console.log("Starting Swagger to Modules generation...");

      const swaggerFilePath = path.resolve(swaggerFile);
      const outputDir = path.resolve(options.output);
      const apiKey = options.apiKey || process.env.OPENROUTER_API_KEY;

      if (!apiKey) {
        console.error(
          "Error: OpenRouter API key is required. Use --api-key option or set OPENROUTER_API_KEY environment variable."
        );
        process.exit(1);
      }

      if (!fs.existsSync(swaggerFilePath)) {
        console.error(`Error: Swagger file not found at ${swaggerFilePath}`);
        process.exit(1);
      }

      try {
        // 1. Parse Swagger
        console.log(`Parsing Swagger file: ${swaggerFilePath}`);
        const swaggerData: ParsedSwaggerData = await parseSwagger(
          swaggerFilePath
        );
        console.log("Swagger file parsed successfully.");

        // 2. Initialize LLM Generator
        console.log(`Initializing LLM generator with model: ${options.model}`);
        const llmGenerator = new LLMGenerator(apiKey, options.model);

        // 3. Initialize File Writer
        console.log(`Setting up output directory: ${outputDir}`);
        const fileWriter = new FileWriter(outputDir);

        // 4. Generate TypeScript Interfaces
        console.log("Generating TypeScript interfaces...");
        const interfaceFiles: Record<string, string> = {};
        for (const [definitionName] of Object.entries(
          swaggerData.definitions || {}
        )) {
          console.log(`  - Generating interface for: ${definitionName}`);
          const prompt = llmGenerator.generateInterfacePrompt(
            swaggerData,
            definitionName
          );
          const interfaceCode = await llmGenerator.generateCode(prompt);
          // Basic cleaning of potential markdown artifacts if any
          const cleanCode = interfaceCode
            .replace(/```typescript\n?|```\n?/g, "")
            .trim();
          interfaceFiles[`models/${definitionName}.ts`] = cleanCode;
        }
        fileWriter.writeTsFiles(interfaceFiles);
        const modelFileNames = Object.keys(interfaceFiles).map((f) =>
          path.basename(f)
        );

        // 5. Generate Service Classes
        console.log("Generating service classes...");
        const serviceFiles: Record<string, string> = {};
        const serviceNames: string[] = []; // Explicitly type as string array
        for (const [pathVal, pathItem] of Object.entries<SwaggerPathItem>(
          swaggerData.paths || {}
        )) {
          // Ensure pathItem is correctly typed for its methods
          const pathItemOperations = pathItem as {
            [key: string]: SwaggerOperation;
          };
          for (const [method, operation] of Object.entries<SwaggerOperation>(
            pathItemOperations
          )) {
            if (
              [
                "get",
                "post",
                "put",
                "delete",
                "patch",
                "head",
                "options",
              ].includes(method)
            ) {
              const serviceName = llmGenerator.generateMethodName(
                pathVal,
                method,
                operation
              );
              serviceNames.push(serviceName);
              console.log(
                `  - Generating service method for: ${serviceName} (${method.toUpperCase()} ${pathVal})`
              );
              const prompt = llmGenerator.generateServiceMethodPrompt(
                swaggerData,
                pathVal,
                method,
                operation
              );
              const methodCode = await llmGenerator.generateCode(prompt);
              const cleanMethodCode = methodCode
                .replace(/```typescript\n?|```\n?/g, "")
                .trim();

              const serviceFileName = `services/${serviceName}Service.ts`;
              let existingServiceCode = serviceFiles[serviceFileName] || ""; // Use empty string if undefined

              const classDeclaration = `export class ${serviceName}Service {\n${cleanMethodCode}\n}`;

              if (
                !existingServiceCode.includes(
                  `export class ${serviceName}Service`
                )
              ) {
                serviceFiles[serviceFileName] = classDeclaration;
              } else {
                console.warn(
                  `Warning: Service file ${serviceFileName} already exists. Overwriting with new class for ${serviceName}. Consider grouping by tag.`
                );
                serviceFiles[serviceFileName] = classDeclaration; // Overwrite for now
              }
            }
          }
        }
        fileWriter.writeTsFiles(serviceFiles);
        const serviceFileNames = Object.keys(serviceFiles).map((f) =>
          path.basename(f)
        );

        // 6. Generate package.json, tsconfig.json, README.md, index.ts, .gitignore
        console.log("Generating configuration files...");
        const projectName = path.basename(outputDir);
        const packageJsonData = {
          name: projectName.toLowerCase().replace(/\s+/g, "-"),
          version: "1.0.0",
          description: `Generated frontend client for ${
            swaggerData.host || "API"
          }`,
          main: "index.ts",
          scripts: {
            build: "tsc",
            start: "node dist/index.js", // Or a dev server script if applicable
            test: 'echo "Error: no test specified" && exit 1',
          },
          dependencies: {
            axios: "^1.6.0", // Use a specific version or lock it
            // Add other common dependencies if needed by generated code (e.g., react-query)
          },
          devDependencies: {
            typescript: "^5.2.2",
            "@types/node": "^20.8.0",
            "ts-node": "^10.9.1",
          },
          keywords: ["swagger", "client", "typescript", "generated"],
          author: "", // Could be configurable
          license: "ISC",
        };
        fileWriter.writePackageJson(packageJsonData);

        const tsConfigData = {
          compilerOptions: {
            target: "ES2020",
            module: "commonjs",
            lib: ["ES2020"],
            outDir: "./dist",
            rootDir: "./",
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            resolveJsonModule: true,
            declaration: true,
            sourceMap: true,
          },
          include: ["**/*.ts"],
          exclude: ["node_modules", "dist"],
        };
        fileWriter.writeTsConfigJson(tsConfigData);

        fileWriter.writeReadme(
          projectName,
          `Generated frontend client for ${swaggerData.host || "an API"}.`
        );
        fileWriter.writeIndexFile({
          models: modelFileNames,
          services: serviceFileNames,
        });
        fileWriter.writeGitignore();

        console.log("\n✅ Generation complete!");
        console.log(`📁 Generated project located at: ${outputDir}`);
        console.log("📝 Next steps:");
        console.log(`  1. cd ${outputDir}`);
        console.log("  2. npm install");
        console.log(
          '  3. Configure axios base URL in your application if needed (e.g., axios.defaults.baseURL = "YOUR_API_URL");'
        );
        console.log("  4. Import and use the generated models and services.");
      } catch (error: any) {
        console.error("\n❌ An error occurred during generation:");
        console.error(error.message || error);
        process.exit(1);
      }
    }
  );

program.parse();
