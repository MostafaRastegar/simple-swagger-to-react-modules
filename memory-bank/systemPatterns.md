# System Patterns

## Domain-Driven Design (DDD) Architecture

### Layered Architecture
The project implements a strict three-layer DDD architecture for generated code:

```
┌─────────────────────┐
│   Presentation      │  ← React Components & Hooks
│      Layer          │
├─────────────────────┤
│   Application       │  ← Services & Use Cases
│      Layer          │
├─────────────────────┤
│      Domain         │  ← Models & Business Logic
│      Layer          │
└─────────────────────┘
```

### Layer Responsibilities

#### Domain Layer
- **Purpose**: Core business logic and data models
- **Contents**: 
  - TypeScript interfaces for data models
  - Business entity definitions
  - Service interfaces (contracts)
- **Dependencies**: Pure business logic, no external dependencies
- **Pattern**: Interface-driven design with clear contracts

#### Application Layer  
- **Purpose**: Use case orchestration and API integration
- **Contents**:
  - Service implementations
  - API client logic
  - Data transformation
  - Request/response handling
- **Dependencies**: Domain layer, HTTP client
- **Pattern**: Service-oriented with dependency injection

#### Presentation Layer
- **Purpose**: UI integration and React hooks
- **Contents**:
  - React hooks for data fetching
  - Component integration logic
  - State management
  - User interaction handling
- **Dependencies**: Application layer, React
- **Pattern**: Hooks-based with separation of concerns

## Code Generation Patterns

### Generator Architecture
```
CLI Tool
├── cli.js (Entry Point)
├── utils.js (Shared Utilities)
└── generators/
    ├── modelGenerator.js
    ├── serviceGenerator.js
    ├── endpointGenerator.js
    └── presentationGenerator.js
```

### Generation Pipeline
1. **Specification Parsing**: Extract data from Swagger/OpenAPI JSON
2. **Resource Analysis**: Identify API resources and endpoints
3. **Model Generation**: Create domain interfaces
4. **Service Generation**: Generate application services
5. **Endpoint Generation**: Create API endpoint definitions
6. **Presentation Generation**: Generate React hooks and patterns
7. **File Writing**: Output structured files to target directory

### Template-Based Generation
- **Dynamic Content**: Templates adapt to API specifications
- **Consistent Patterns**: Generated code follows established patterns
- **Type Safety**: All generated code includes TypeScript types
- **DDD Compliance**: Generated architecture respects layer boundaries

## API Integration Patterns

### Service Layer Pattern
```typescript
// Generated service follows consistent pattern
function Service(): ServiceInterface {
  return {
    method1: () => serviceHandler(() => request.get(endpoint)),
    method2: (params) => serviceHandler(() => request.post(endpoint, params)),
  };
}
```

### Error Handling Pattern
- **Unified Error Management**: All services use consistent error handling
- **Response Wrapping**: Standardized response object structure
- **Type Safety**: Error types included in generated interfaces

### Authentication Pattern
- **Configurable Auth**: Support for multiple authentication schemes
- **Header Management**: Automated header injection
- **Token Handling**: Consistent token management across services

## File Organization Patterns

### Module Structure
```
generated-module/
├── domain/
│   ├── models/
│   │   └── ModelName.ts
│   └── ServiceInterface.ts
├── ModelName.service.ts
├── ModelName.presentation.ts
└── endpoints.ts
```

### Naming Conventions
- **CamelCase**: All TypeScript identifiers use camelCase
- **PascalCase**: Interfaces use PascalCase
- **Consistent Prefixes**: Service and presentation files use same prefix
- **Domain Suffix**: Interface files use descriptive suffixes (Service, Model, etc.)

## React Integration Patterns

### Hook-Based Architecture
```typescript
// Generated presentation layer uses hooks
export function useGetData() {
  return useQuery({
    queryKey: ['data'],
    queryFn: () => service.getData(),
  });
}
```

### State Management
- **React Query Integration**: Generated hooks use React Query patterns
- **Optimistic Updates**: Support for optimistic UI updates
- **Error Boundaries**: Consistent error handling in components

### Component Integration
- **Props Interface**: Clear prop definitions for components
- **Type Safety**: Full TypeScript coverage for component props
- **Reusable Patterns**: Generated components follow React best practices

## CLI Tool Patterns

### Command-Line Interface
- **Simple Commands**: Minimal required parameters
- **Flexible Output**: Configurable output directory and naming
- **Error Handling**: Clear error messages and validation

### File System Operations
- **Atomic Writes**: File operations are atomic to prevent corruption
- **Directory Creation**: Automatic directory structure creation
- **Template Processing**: Dynamic template filling with spec data

## Error Handling Patterns

### Validation Patterns
- **Input Validation**: Swagger spec validation before processing
- **Type Checking**: Runtime type checking where needed
- **Graceful Degradation**: Partial spec support with warnings

### User Experience Patterns
- **Progress Feedback**: Real-time feedback during generation
- **Clear Messages**: Descriptive error and success messages
- **Recovery Options**: Suggestions for fixing validation errors

## Testing Patterns

### Generated Code Testing
- **Unit Test Ready**: Generated code structured for easy testing
- **Mock Integration**: Service layer designed for easy mocking
- **Integration Tests**: End-to-end testing patterns included

### Tool Testing
- **Specification Testing**: Multiple Swagger spec formats tested
- **Output Validation**: Generated code quality verification
- **Regression Testing**: Ensure changes don't break existing patterns
