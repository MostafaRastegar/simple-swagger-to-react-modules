# Project Context: Swagger to DDD Module Generator

## 1. Previous Conversation
The user requested to read the README.md file and implement the 'pet' tag from swagger.json using a Domain-Driven Design (DDD) approach. I analyzed the README.md, which outlined a DDD project structure with domain, application, and presentation layers. I developed a Node.js script (swagger-to-ddd.js) to automatically generate DDD modules from Swagger JSON files, following the structure in README.md.

## 2. Current Work
The swagger-to-ddd.js script has been created and used to generate the 'pet' module. The generation process completed successfully, creating files for the pet module including models, service interface, service implementation, presentation hooks, and endpoint definitions. The script has undergone several iterations to fix syntax errors and improve the generation logic. The latest execution was:
`node swagger-to-ddd.js generate -i swagger.json -m pet -o src/modules`

## 3. Key Technical Concepts
- **Domain-Driven Design (DDD)**: Structured with domain, application, and presentation layers.
- **Swagger/OpenAPI Specification**: Used as the input for generating API client modules.
- **TypeScript**: Primary language for generated code, ensuring type safety.
- **React Query (@tanstack/react-query)**: For data fetching and state management in the presentation layer.
- **Axios**: For making HTTP requests.
- **Prettier**: For code formatting.
- **Node.js & Commander.js**: For building the CLI tool.
- **File System Operations (fs.promises)**: For reading/writing generated files.
- **Path Manipulation (path module)**: For handling file paths.

## 4. Relevant Files and Code

### Core Script
- **swagger-to-ddd.js**
  - Main CLI script for generating DDD modules from Swagger JSON.
  - Functions: `generateModels`, `generateServiceInterface`, `generateServiceImplementation`, `generatePresentationHooks`, `updateEndpointsFile`.
  - Latest fixes addressed service interface syntax errors and parameter handling.

### Input Specification
- **swagger.json**
  - Defines the "petstore" API with various tags, including "pet".
  - Pet tag endpoints: `/pet/{petId}/uploadImage`, `/pet`, `/pet/findByStatus`, `/pet/findByTags`, `/pet/{petId}`, etc.
  - Key definitions: `Pet`, `Category`, `Tag`, `ApiResponse`.

### Generated Pet Module (src/modules/pet/)
- **domains/models/pet.ts**
  ```typescript
  export interface Pet {
    id?: number;
    category?: Record<string, any>;
    name: string;
    photoUrls: Array<string>;
    tags?: Array<Record<string, any>>;
    status?: 'available' | 'pending' | 'sold';
  }
  // ... Category, Tag interfaces, DTOs
  ```
- **domains/Ipet.service.ts**
  ```typescript
  export interface IPetService {
    uploadFile(petId: number): Promise<Record<string, any>>;
    add(body: Record<string, any>): Promise<any>;
    // ... other service methods
  }
  ```
- **pet.service.ts**
  ```typescript
  function PetService(): IPetService {
    return {
      uploadFile: (petId: number) =>
        serviceHandler<Pet>(() =>
          request.post(endpoints.PET.uploadFile(petId), body), // 'body' is undefined here
      // ... other method implementations
    };
  }
  ```
- **pet.presentation.ts**
  ```typescript
  export function PetPresentation() {
    return {
      useUploadFile: (variables: any, onSuccess?, onError?) =>
        useMutation({
          mutationFn: () => petservice.uploadFile(variables.petId),
          onSuccess,
          onError,
        }),
      // ... other hooks
    };
  }
  ```
- **constants/endpoints.ts**
  ```typescript
  export const endpoints = {
    PET: {
      uploadFile: (petId) => `${BASE_URL}/pet/${petId}/uploadImage`,
      // ... other endpoint functions
    },
  };
  ```

### Configuration
- **package.json**: Defines project dependencies like `axios`, `prettier`, `commander`, `@tanstack/react-query`.
- **README.md**: Describes the DDD structure and provides examples.

## 5. Problem Solving
- Fixed syntax errors in `generateServiceInterface` that caused duplicate 'body' parameters.
- Corrected endpoint generation to use dynamic functions instead of static strings.
- Resolved Swagger type mapping to TypeScript types.
- Addressed issues with `serviceHandler` calls in `pet.service.ts` where `body` was used as an undefined variable.
- Handled Prettier formatting to prevent syntax errors.

## 6. Pending Tasks and Next Steps
- **Verify TypeScript compilation** for all generated pet module files.
- **Test the generated pet module's functionality** in a sample application.
- **Address the 'body' undefined variable issue** in `pet.service.ts` methods like `uploadFile`, `add`, `update`, `updateWithForm`.
- **Improve type definitions** in `Ipet.service.ts` and `pet.presentation.ts` to be more specific than `Record<string, any>` or `any`.
- **Ensure parameters are correctly passed** to service methods from presentation hooks.

The user's original request was: "فایل 'README.md' را مطالعه کن و تگ pet از 'swagger.json' را پیاده کن"
The generated pet module is structurally in place but requires refinement of type safety and parameter passing.
