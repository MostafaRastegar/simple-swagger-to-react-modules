# Active Context: Swagger to Modules

## Current Work Focus
The focus has shifted from initial setup to implementing the core Swagger parsing logic and enhancing the code generation capabilities. The basic CLI and project structure are complete, and the next phase involves enriching the `src/parser/swagger.ts` to provide a more structured internal representation of the API, and developing more sophisticated templates in `src/generator/` and `src/templates/`.

## Recent Changes
- Configured `tsconfig.json` with `resolveJsonModule` and excluded `package.json` from compilation.
- Set up `package.json` with build/start scripts and defined the `swagger-to-modules` CLI binary.
- Implemented the main CLI entry point (`src/index.ts`) using `yargs`, including a `generate [specPath]` command.
- Created stub files for all main modules: `src/cli/generate.ts`, `src/parser/swagger.ts`, `src/generator/module.ts`, `src/templates/module.hbs`, `src/utils/template.ts`, and `src/utils/index.ts`.
- The `generate` command now reads a Swagger JSON, uses a basic Handlebars template (`module.hbs`), and writes the output to `generated/module.ts`.
- A sample `swagger.json` has been added for testing.

## Next Steps
1. **Enhance Swagger Parser**: Implement detailed parsing in `src/parser/swagger.ts` to extract and normalize paths, operations, parameters, schemas, etc., from Swagger 2.0/3.0.x files into a common internal format.
2. **Develop Code Generation Logic**: Evolve `src/generator/module.ts` and `src/templates/module.hbs` to produce well-structured, commented, and modular code (e.g., client classes, type definitions, endpoint functions) based on the parsed data.
3. **Improve Template System**: Expand the use of Handlebars, potentially with helper functions, to allow for more flexible and powerful code generation.
4. **Error Handling and Validation**: Implement robust error handling in the parser and CLI for invalid Swagger files or missing configurations.
5. **Testing**: Introduce a testing framework (e.g., Jest) and write unit/integration tests.
6. **Documentation**: Create user guides for CLI usage and configuration.

## Active Decisions and Considerations
- **CLI Structure**: The `yargs` library is being used for its simplicity and features in building the CLI. The `generate` command accepts a `specPath` argument.
- **Templating**: Handlebars is chosen for its flexibility and the ability for users to customize templates.
- **Project Structure**: The modular structure (`src/cli`, `src/parser`, `src/generator`, `src/templates`, `src/utils`) is actively being used.
- **Output**: The initial output is a single `module.ts` file. Future iterations will aim for a more granular and organized output (e.g., multiple files for models, services).

## Learnings and Project Insights
- The initial setup of TypeScript and build tools was crucial and went smoothly.
- Using stubs for modules helped in quickly establishing the workflow and CLI integration.
- The current basic implementation successfully demonstrates the end-to-end flow, providing a foundation for more complex features.
- The importance of having a clear internal data model after parsing Swagger is becoming evident for the next development steps.
