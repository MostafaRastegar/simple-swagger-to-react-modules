# Tech Context: Swagger to Modules

## Technologies Used
- **Runtime**: Node.js (LTS version)
- **Language**: TypeScript for developing the tool.
- **CLI Framework**: `yargs` or `commander.js` for building the command-line interface.
- **Templating Engine**: `Handlebars` for flexible code generation from templates.
- **Swagger/OpenAPI Parsing**: `@apidevtools/swagger-parser` for robust parsing and validation of Swagger files.
- **File System**: Node.js built-in `fs` and `path` modules for file and directory operations.
- **Package Management**: npm or yarn.

## Development Setup
1. **Initialize Project**:
   ```bash
   npm init -y
   npm install typescript ts-node @types/node @types/jest jest --save-dev
   npx tsc --init
   ```
2. **Project Structure**:
   ```
   swagger-to-modules/
   ├── src/
   │   ├── cli/          # Command-line interface logic
   │   ├── parser/       # Swagger parsing logic
   │   ├── generator/    # Code generation logic
   │   ├── templates/    # Default code templates
   │   └ utils/         # Utility functions
   ├── test/             # Test files
   ├── memory-bank/      # Project memory and documentation
   ├── templates/        # User-defined templates (optional)
   ├── dist/             # Compiled JavaScript output
   ├── swagger.json      # Example Swagger file
   └── config.json       # Default configuration (optional)
   ```
3. **Scripts**:
   - `build`: Compile TypeScript to JavaScript (`tsc`).
   - `start`: Run the compiled CLI (`node dist/index.js`).
   - `dev`: Run the CLI in development mode (`ts-node src/index.ts`).
   - `test`: Run Jest tests (`jest`).

## Technical Constraints
- **Node.js Environment**: The tool will run in a Node.js environment.
- **CLI Focused**: Primarily designed for command-line usage.
- **OpenAPI Specification**: Must correctly parse files compliant with OpenAPI 2.0 (Swagger) and 3.0.x.
- **File System Operations**: Relies on standard file system access patterns.

## Dependencies
- **@apidevtools/swagger-parser**: For parsing and validating Swagger/OpenAPI files.
- **handlebars**: For template-based code generation.
- **yargs**: For creating a user-friendly CLI.
- **chalk**: (Optional) For colored console output.
- **fs-extra**: (Optional) Enhanced file system operations.

## Tool Usage Patterns
- **Command Execution**: `swagger-to-modules --input ./path/to/swagger.json --output ./generated/code --template typescript`
- **Configuration File**: `swagger-to-modules --config ./my-config.json`
- **Help Command**: `swagger-to-modules --help`
