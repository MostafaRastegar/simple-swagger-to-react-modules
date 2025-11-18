# Simple Swagger to React Modules

A powerful CLI tool that generates complete Domain-Driven Design (DDD) modules with UI components from Swagger/OpenAPI specifications. This tool creates full-stack React applications with Next.js App Router, TypeScript, and modern UI libraries.

## Features

- **Complete DDD Architecture**: Generates domain models, services, presentation hooks, and store management
- **UI Component Generation**: Automatically creates Next.js App Router pages and React components
- **Modal System**: Generates Add, Edit, and Delete modals with form validation
- **TypeScript Support**: Full type safety throughout the generated code
- **Modern UI Stack**: Ant Design components with React Query integration
- **State Management**: React Constore for efficient state handling

## Installation

```bash
npm install
npm link
```

## Usage

### Generate Complete Module with UI

```bash
# Generate a complete DDD module with UI components
node cli/cli.js generate -i swagger.json -m pet -o src

# Or use the shorter alias
node cli/cli.js g -i swagger.json -m user -o src
```

### Generate Only UI Components

```bash
# Generate UI components for an existing module
node cli/cli.js ui -m pet -o src
```

## Generated Structure

When you run the generator, it creates a complete DDD module structure:

```
src/pet/
├── domains/
│   ├── models/
│   │   └── Pet.ts              # Domain model
│   └── IPetService.ts          # Service interface
├── pet.service.ts              # Service implementation
├── pet.presentation.ts         # React Query hooks
├── pet.store.ts                # State management
├── pet.view.tsx                # Main view component
├── page.tsx                    # Next.js App Router page
├── AddModal.tsx                # Create modal
├── EditModal.tsx               # Edit modal
├── DeleteModal.tsx             # Delete confirmation modal
└── ModalFooter.tsx             # Shared modal footer
```

## Generated UI Components

### Page Component (`page.tsx`)
- Next.js App Router integration
- Data fetching with React Query
- State management integration
- Responsive layout

### View Component (`pet.view.tsx`)
- Data table with pagination
- Search and filtering
- Action buttons (Add, Edit, Delete)
- Loading and error states

### Modal Components
- **AddModal**: Form for creating new items with validation
- **EditModal**: Pre-filled form for editing existing items
- **DeleteModal**: Confirmation dialog for deletions
- **ModalFooter**: Reusable footer with consistent styling

## Technologies Used

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **UI Library**: Ant Design
- **Data Fetching**: TanStack Query (React Query)
- **State Management**: React Constore
- **Styling**: CSS Modules
- **API Integration**: Axios with interceptors

## Configuration

### Swagger Specification
The tool works with standard Swagger/OpenAPI 2.0 and 3.0 specifications. It automatically detects:
- Model definitions
- API endpoints
- Request/response schemas
- Required fields

### Customization
You can customize the generated code by modifying the generator templates in:
- `cli/generators/` - Core generators
- `cli/generators/appRouteGenerator.js` - UI components
- `cli/generators/modalGenerator.js` - Modal components
- `cli/generators/storeGenerator.js` - State management

## Example Output

Generated components include:
- TypeScript interfaces and types
- Form validation with Ant Design
- Error handling and loading states
- Consistent styling and layouts
- Integration with existing service layer

## Development

### Project Structure
```
├── cli/                          # CLI and generators
│   ├── cli.js                   # Main CLI entry point
│   ├── generators/              # Code generators
│   │   ├── modelGenerator.js    # Domain models
│   │   ├── serviceGenerator.js  # Service layer
│   │   ├── presentationGenerator.js # React hooks
│   │   ├── storeGenerator.js    # State management
│   │   ├── appRouteGenerator.js # UI pages
│   │   ├── modalGenerator.js    # Modal components
│   │   └── endpointGenerator.js # API endpoints
│   └── utils.js                 # Utility functions
├── example/                     # Example output
├── swagger.json                 # Sample API spec
└── memory-bank/                 # Project documentation
```

## API Documentation

### CLI Commands

#### `generate` / `g`
Generate a complete DDD module with UI components.

**Options:**
- `-i, --input <file>`: Input Swagger JSON file path (required)
- `-m, --module-name <name>`: Name of the module (required)
- `-o, --output-dir <dir>`: Output directory (required)
- `--base-url <url>`: Base API URL (default: https://petstore.swagger.io/v2)

#### `ui`
Generate only UI components for an existing module.

**Options:**
- `-m, --module-name <name>`: Name of the existing module (required)
- `-o, --output-dir <dir>`: Output directory (required)

## Troubleshooting

### Common Issues

1. **Syntax Error in Generated Files**: Check that your Swagger specification is valid
2. **Missing Dependencies**: Ensure you have all required npm packages installed
3. **Path Issues**: Use relative paths for output directories

### Getting Help

Check the generated files in the `example/` directory for reference implementations.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add your improvements
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

---

**Status**: ✅ **Phase 4 Complete** - The CLI is fully functional and generates complete DDD modules with UI components including modals, pages, and state management.

**Last Updated**: November 8, 2025
