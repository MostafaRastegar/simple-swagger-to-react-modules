# Tech Context

## Core Technologies

### Language & Runtime
- **Node.js**: Primary runtime environment for CLI tool
- **TypeScript**: Type-safe development for better code quality and maintainability
- **JavaScript (ES6+)**: Core scripting language with modern syntax features

### Development Tools
- **npm/yarn**: Package management and dependency handling
- **CLI Interface**: Command-line tool implementation for easy integration
- **File System Operations**: Node.js fs模块 for file generation and manipulation

## Project Architecture

### Module Structure
```
cli/
├── cli.js              # Main CLI entry point
├── utils.js            # Shared utilities and helpers
└── generators/         # Code generation modules
    ├── modelGenerator.js     # Domain model generation
    ├── serviceGenerator.js   # Application service generation
    ├── endpointGenerator.js  # API endpoint definitions
    └── presentationGenerator.js # React presentation layer generation
```

### Code Generation Pipeline
1. **Parse Swagger Spec**: Extract API definitions from swagger.json
2. **Generate Models**: Create TypeScript interfaces for data structures
3. **Generate Services**: Create application service layer with API calls
4. **Generate Endpoints**: Create endpoint definitions and constants
5. **Generate Presentation**: Create React hooks and presentation logic

## Dependencies & Libraries

### Runtime Dependencies
- **Node.js Built-ins**: fs, path, util for file operations and utilities
- **No External Runtime Dependencies**: Minimal footprint approach

### Development Dependencies (inferred from structure)
- **TypeScript Compiler**: For type checking and compilation
- **Node.js Types**: Type definitions for Node.js APIs

## Technical Constraints

### Swagger/OpenAPI Support
- **Version**: Swagger 2.0 specification format
- **API Types**: REST APIs with JSON request/response
- **Authentication**: Support for API key and OAuth2 authentication schemes

### Output Requirements
- **TypeScript**: All generated code must be type-safe TypeScript
- **React Integration**: Generated presentation layer must work with React
- **DDD Compliance**: Generated code must follow Domain-Driven Design patterns

### File Structure Constraints
- **Modular Organization**: Each API resource becomes a separate module
- **Layer Separation**: Clear boundaries between domain, application, and presentation
- **Consistent Naming**: Standardized naming conventions across all generated files

## Tool Usage Patterns

### CLI Commands
- **Input**: Swagger/OpenAPI specification file path
- **Output Directory**: Target directory for generated modules
- **Module Name**: Resource name for the generated module

### Code Generation Process
1. **Specification Parsing**: Read and validate Swagger JSON
2. **Resource Extraction**: Identify API resources and endpoints
3. **Model Generation**: Create TypeScript interfaces for data models
4. **Service Layer**: Generate application services with API integration
5. **Presentation Layer**: Create React hooks and presentation logic
6. **File Output**: Write generated files to target directory

### Error Handling
- **Validation**: Ensure input Swagger specification is valid
- **Graceful Degradation**: Handle partial specifications without complete failure
- **User Feedback**: Clear error messages for CLI users

## Development Setup

### Environment Requirements
- **Node.js**: Version 14+ for modern JavaScript features
- **npm/yarn**: For dependency management

### File Organization
- **Source Files**: JavaScript/TypeScript source code
- **Generated Files**: Output directory for generated modules
- **Configuration**: Package.json for project metadata and scripts
- **Examples**: Sample Swagger specs and generated output for testing

### Build Process
- **No Build Step**: CLI tool runs directly from source
- **File Generation**: Real-time code generation during CLI execution

## Integration Patterns

### Generated Code Structure
Each generated module follows DDD pattern:
- **Domain Layer**: Data models and business entities
- **Application Layer**: Services and API integration logic
- **Presentation Layer**: React hooks and UI integration

### API Integration
- **HTTP Client**: Standardized request handling
- **Authentication**: Support for various auth schemes
- **Error Handling**: Consistent error management across all services
