#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { Command } = require("commander");
const path = require("path");
const fs = require("fs-extra");
const dotenv = require("dotenv");
const readline = require("readline"); // Added for tag selection
const LLMGenerator = require("./generator/llm-generator").default ||
    require("./generator/llm-generator");
const FileWriter = require("./writer/file-writer").default || require("./writer/file-writer");
const { parseSwagger } = require("./parser/swagger-parser");
// Load environment variables from .env file
dotenv.config();
const program = new Command();
program
    .name("swagger-to-modules")
    .description("Generates frontend modules from a Swagger JSON file using an LLM.")
    .version("1.0.0");
program
    .command("generate")
    .alias("g")
    .description("Generate frontend modules from a Swagger file.")
    .argument("<swagger-file>", "Path to the Swagger JSON file.")
    .option("-o, --output <dir>", "Output directory for generated code", "generated-frontend")
    .option("-m, --model <model>", "LLM model to use (e.g., z-ai/glm-4.5-air:free)", "z-ai/glm-4.5-air:free")
    .option("-k, --api-key <key>", "OpenRouter API key (or set OPENROUTER_API_KEY env var)")
    .option("-t, --tags <tags>", "Comma-separated list of tags to generate (e.g., 'pet,store')")
    .action(async (swaggerFile, options) => {
    console.log("Starting Swagger to Modules generation...");
    const swaggerFilePath = path.resolve(swaggerFile);
    const outputDir = path.resolve(options.output);
    const apiKey = options.apiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error("Error: OpenRouter API key is required. Use --api-key option or set OPENROUTER_API_KEY environment variable.");
        process.exit(1);
    }
    if (!fs.existsSync(swaggerFilePath)) {
        console.error(`Error: Swagger file not found at ${swaggerFilePath}`);
        process.exit(1);
    }
    try {
        // 1. Parse Swagger
        console.log(`Parsing Swagger file: ${swaggerFilePath}`);
        const swaggerData = await parseSwagger(swaggerFilePath);
        console.log("Swagger file parsed successfully.");
        // 2. Initialize LLM Generator
        console.log(`Initializing LLM generator with model: ${options.model}`);
        const llmGenerator = new LLMGenerator(apiKey, options.model);
        // 3. Initialize File Writer
        console.log(`Setting up output directory: ${outputDir}`);
        const fileWriter = new FileWriter(outputDir);
        // 4. Generate Tag List and save as tags.md
        console.log("Fetching available tags from Swagger data...");
        const tagListPrompt = llmGenerator.generateTagListPrompt(swaggerData);
        const tagListText = await llmGenerator.generateCode(tagListPrompt);
        const swaggerDataDir = path.resolve("./swagger-generated-data");
        await fs.ensureDir(swaggerDataDir);
        const tagsMdPath = path.join(swaggerDataDir, "tags.md");
        await fs.writeFile(tagsMdPath, tagListText);
        console.log(`\n✅ Tag list saved to: ${tagsMdPath}`);
        console.log("\n--- Available Tags (also in tags.md) ---");
        console.log(tagListText);
        console.log("----------------------------------------\n");
        // 5. Determine tags to generate
        let selectedTagNames = [];
        if (options.tags) {
            selectedTagNames = options.tags
                .split(",")
                .map((tag) => tag.trim())
                .filter((tag) => tag.length > 0);
            console.log(`\nGenerating modules for specified tags: ${selectedTagNames.join(", ")}`);
        }
        else {
            // Fallback to interactive selection if --tags is not provided
            console.log("\n--- Interactive Tag Selection ---");
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });
            const selectedTagsInput = await new Promise((resolve) => {
                rl.question("Enter the numbers of the tags you want to generate (comma-separated, e.g., 1,3,4): ", (answer) => {
                    resolve(answer);
                });
            });
            rl.close();
            // Parse input from tags.md content to get tag names based on numbers
            const tagsMdContent = await fs.readFile(tagsMdPath, "utf-8");
            const tagLines = tagsMdContent
                .split("\n")
                .filter((line) => line.trim().startsWith("- **"));
            const selectedTagIndexes = selectedTagsInput
                .split(",")
                .map((idx) => parseInt(idx.trim(), 10) - 1)
                .filter((idx) => !isNaN(idx) && idx >= 0 && idx < tagLines.length);
            selectedTagNames = selectedTagIndexes
                .map((index) => {
                const line = tagLines[index];
                const match = line.match(/\*\*(.*?)\*\*/);
                return match ? match[1] : null;
            })
                .filter(Boolean);
            if (selectedTagNames.length === 0) {
                console.log("No tags selected. Exiting.");
                process.exit(0);
            }
            console.log(`Selected tags for generation: ${selectedTagNames.join(", ")}`);
        }
        // 6. Group Swagger data by tags
        console.log("\nGrouping Swagger data by tags...");
        const allTagGroups = groupSwaggerDataByTags(swaggerData);
        console.log(`Found ${allTagGroups.length} tag groups in Swagger: ${allTagGroups
            .map((tg) => tg.tagName)
            .join(", ")}`);
        const selectedTagGroups = allTagGroups.filter((tagGroup) => selectedTagNames.includes(tagGroup.tagName));
        if (selectedTagGroups.length === 0) {
            console.log("No valid tags selected based on the input. Exiting.");
            process.exit(0);
        }
        console.log(`Selected ${selectedTagGroups.length} tag groups for generation: ${selectedTagGroups
            .map((tg) => tg.tagName)
            .join(", ")}`);
        // 6. Generate files for each selected tag group
        const allGeneratedFiles = {};
        for (const tagGroup of selectedTagGroups) {
            console.log(`\n--- Processing Tag: ${tagGroup.tagName} ---`);
            // 5a. Generate Models for the tag
            console.log(`  Generating models for tag: ${tagGroup.tagName}`);
            for (const [definitionName, definition] of Object.entries(tagGroup.associatedModels)) {
                console.log(`    - Generating interface for: ${definitionName}`);
                const prompt = llmGenerator.generateInterfacePrompt(swaggerData, definitionName);
                const interfaceCode = await llmGenerator.generateCode(prompt);
                const cleanCode = interfaceCode
                    .replace(/```typescript\n?|```\n?/g, "")
                    .trim();
                allGeneratedFiles[`src/modules/${tagGroup.tagName}/domains/models/${definitionName}.ts`] = cleanCode;
            }
            // 5b. Generate Service Interface for the tag
            console.log(`  Generating service interface for tag: ${tagGroup.tagName}`);
            const serviceInterfacePrompt = llmGenerator.generateServiceInterfacePrompt(swaggerData, tagGroup.tagName, tagGroup.associatedOperations);
            const serviceInterfaceCode = await llmGenerator.generateCode(serviceInterfacePrompt);
            const cleanServiceInterfaceCode = serviceInterfaceCode
                .replace(/```typescript\n?|```\n?/g, "")
                .trim();
            allGeneratedFiles[`src/modules/${tagGroup.tagName}/domains/I${tagGroup.tagName}Service.ts`] = cleanServiceInterfaceCode;
            // 5c. Generate Service Implementation for the tag
            console.log(`  Generating service implementation for tag: ${tagGroup.tagName}`);
            const serviceImplementationPrompt = llmGenerator.generateServiceImplementationPrompt(swaggerData, tagGroup.tagName, tagGroup.associatedOperations, cleanServiceInterfaceCode // Pass the generated interface for context
            );
            const serviceImplementationCode = await llmGenerator.generateCode(serviceImplementationPrompt);
            const cleanServiceImplementationCode = serviceImplementationCode
                .replace(/```typescript\n?|```\n?/g, "")
                .trim();
            allGeneratedFiles[`src/modules/${tagGroup.tagName}/${tagGroup.tagName}.service.ts`] = cleanServiceImplementationCode;
            // 5d. Generate Presentation Layer for the tag
            console.log(`  Generating presentation layer for tag: ${tagGroup.tagName}`);
            const presentationPrompt = llmGenerator.generatePresentationLayerPrompt(swaggerData, tagGroup.tagName, tagGroup.associatedOperations, cleanServiceInterfaceCode // Pass the generated interface for context
            );
            const presentationCode = await llmGenerator.generateCode(presentationPrompt);
            const cleanPresentationCode = presentationCode
                .replace(/```typescript\n?|```\n?/g, "")
                .trim();
            allGeneratedFiles[`src/modules/${tagGroup.tagName}/${tagGroup.tagName}.presentation.ts`] = cleanPresentationCode;
        }
        // 6. Write all generated files
        console.log("\nWriting all generated files...");
        fileWriter.writeTsFiles(allGeneratedFiles);
        // 7. Generate package.json, tsconfig.json, README.md, index.ts, .gitignore
        console.log("\nGenerating configuration files...");
        const projectName = path.basename(outputDir);
        const packageJsonData = {
            name: projectName.toLowerCase().replace(/\s+/g, "-"),
            version: "1.0.0",
            description: `Generated frontend client for ${swaggerData.host || "API"}`,
            main: "src/index.ts", // Adjusted if output is src/...
            scripts: {
                build: "tsc",
                start: "node dist/index.js", // Or a dev server script if applicable
                test: 'echo "Error: no test specified" && exit 1',
            },
            dependencies: {
                axios: "^1.6.0",
                "@tanstack/react-query": "^5.0.0", // Added React Query
                // Add other common dependencies if needed by generated code
            },
            devDependencies: {
                typescript: "^5.2.2",
                "@types/node": "^20.8.0",
                "ts-node": "^10.9.1",
            },
            keywords: ["swagger", "client", "typescript", "generated"],
            author: "",
            license: "ISC",
        };
        fileWriter.writePackageJson(packageJsonData);
        const tsConfigData = {
            compilerOptions: {
                target: "ES2020",
                module: "commonjs",
                lib: ["ES2020"],
                outDir: "./dist", // Output dist at the root of the project
                rootDir: "./src", // Source files are in src/
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true,
                resolveJsonModule: true,
                declaration: true,
                sourceMap: true,
            },
            include: ["src/**/*"], // Only include src directory
            exclude: ["node_modules", "dist"],
        };
        fileWriter.writeTsConfigJson(tsConfigData);
        fileWriter.writeReadme(projectName, `Generated frontend client for ${swaggerData.host || "an API"}.`);
        // Generate an index.ts in the src/ directory to re-export modules
        const srcIndexContent = generateSrcIndexContent(selectedTagGroups);
        fileWriter.writeTsFile("src/index.ts", srcIndexContent);
        fileWriter.writeGitignore();
        console.log("\n✅ Generation complete!");
        console.log(`📁 Generated project located at: ${outputDir}`);
        console.log("📝 Next steps:");
        console.log(`  1. cd ${outputDir}`);
        console.log("  2. npm install");
        console.log('  3. Configure axios base URL in your application if needed (e.g., in your setup file: axios.defaults.baseURL = "YOUR_API_URL");');
        console.log("  4. Import and use the generated modules from src/index.ts or directly from src/modules/.");
    }
    catch (error) {
        console.error("\n❌ An error occurred during generation:");
        console.error(error.message || error);
        process.exit(1);
    }
});
program.parse();
/**
 * Groups Swagger data by tags.
 * @param {ParsedSwaggerData} swaggerData - The parsed Swagger data.
 * @returns {TagGroupData[]} - An array of tag groups.
 */
function groupSwaggerDataByTags(swaggerData) {
    const tagMap = {};
    // Initialize tags from Swagger root definition
    if (swaggerData.tags) {
        swaggerData.tags.forEach((tagInfo) => {
            if (!tagMap[tagInfo.name]) {
                tagMap[tagInfo.name] = {
                    tagName: tagInfo.name,
                    associatedModels: {},
                    associatedOperations: [],
                };
            }
        });
    }
    // Create default tag if no other tags are found/used
    const defaultTagName = "General";
    if (!Object.keys(tagMap).length) {
        tagMap[defaultTagName] = {
            tagName: defaultTagName,
            associatedModels: {},
            associatedOperations: [],
        };
    }
    // Associate operations with tags
    for (const [pathVal, pathItem] of Object.entries(swaggerData.paths || {})) {
        for (const [method, operation] of Object.entries(pathItem)) {
            if (["get", "post", "put", "delete", "patch", "head", "options"].includes(method.toLowerCase())) {
                const operationTags = (operation && operation.tags) || [defaultTagName];
                const primaryTag = operationTags[0]; // Use the first tag
                if (!tagMap[primaryTag]) {
                    tagMap[primaryTag] = {
                        tagName: primaryTag,
                        associatedModels: {},
                        associatedOperations: [],
                    };
                }
                if (operation) {
                    // Ensure operation is defined
                    tagMap[primaryTag].associatedOperations.push({
                        path: pathVal,
                        method: method.toLowerCase(),
                        operation,
                    });
                }
            }
        }
    }
    // Associate models with tags based on usage in operations
    for (const [tagName, tagGroup] of Object.entries(tagMap)) {
        const usedDefinitionNames = new Set();
        for (const op of tagGroup.associatedOperations) {
            const operation = op.operation; // SwaggerOperation is guaranteed to be defined here by AssociatedOperation type
            // Check parameters
            if (operation && operation.parameters) {
                // Check operation again for safety, though type implies it's defined
                for (const param of operation.parameters) {
                    if (param.schema) {
                        findDefinitionsInSchema(param.schema, usedDefinitionNames, swaggerData.definitions);
                    }
                }
            }
            // Check responses
            if (operation && operation.responses) {
                // Check operation again for safety
                for (const response of Object.values(operation.responses)) {
                    if (response.schema) {
                        findDefinitionsInSchema(response.schema, usedDefinitionNames, swaggerData.definitions);
                    }
                }
            }
        }
        // Add definitions to the tag group
        for (const defName of usedDefinitionNames) {
            if (swaggerData.definitions && swaggerData.definitions[defName]) {
                tagGroup.associatedModels[defName] = swaggerData.definitions[defName];
            }
        }
    }
    return Object.values(tagMap);
}
/**
 * Recursively finds $ref definitions in a schema.
 */
function findDefinitionsInSchema(schema, definitionNames, allDefinitions) {
    if (schema.$ref) {
        const refName = schema.$ref.split("/").pop();
        if (refName && allDefinitions && allDefinitions[refName]) {
            definitionNames.add(refName);
            // Also check properties of the definition itself if it's an object
            const def = allDefinitions[refName];
            if (def.properties) {
                for (const prop of Object.values(def.properties)) {
                    if (typeof prop === "object" && prop !== null) {
                        findDefinitionsInSchema(prop, definitionNames, allDefinitions);
                    }
                }
            }
        }
    }
    else if (schema.type === "object" && schema.properties) {
        for (const prop of Object.values(schema.properties)) {
            if (typeof prop === "object" && prop !== null) {
                findDefinitionsInSchema(prop, definitionNames, allDefinitions);
            }
        }
    }
    else if (schema.type === "array" && schema.items) {
        findDefinitionsInSchema(schema.items, definitionNames, allDefinitions);
    }
}
/**
 * Generates the content for the main src/index.ts file.
 * @param {TagGroupData[]} tagGroups - The tag groups.
 * @returns {string} The content for src/index.ts.
 */
function generateSrcIndexContent(tagGroups) {
    let content = "// Generated by swagger-to-modules\n\n";
    tagGroups.forEach((tagGroup) => {
        content += `// Module for ${tagGroup.tagName}\n`;
        content += `export * as ${tagGroup.tagName}Module from './modules/${tagGroup.tagName}';\n\n`;
    });
    return content;
}
//# sourceMappingURL=index.js.map