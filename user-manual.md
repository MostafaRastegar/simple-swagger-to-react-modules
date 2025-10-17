# Swagger-to-Modules: User Manual

This tool converts a Swagger (OpenAPI) definition into a TypeScript frontend project organized by tags, including service classes, interfaces, and React Query hooks, using an LLM.

## Prerequisites

*   Node.js and npm installed.
*   A valid OpenRouter API key.
*   A Swagger JSON file (e.g., `swagger.json`).

## Setup

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Configure API Key:**
    *   Copy `.env.example` to `.env`:
        ```bash
        cp .env.example .env
        ```
    *   Open `.env` and add your OpenRouter API key:
        ```
        OPENROUTER_API_KEY=your_api_key_here
        ```
    *   (Optional) Set your preferred model. The default is `z-ai/glm-4.5-air:free`.

## Usage

1.  **Run the Tool:**
    Execute the script from your terminal, providing the path to your Swagger file and an output directory:
    ```bash
    node dist/index.js generate ./path/to/your/swagger.json --output-dir ./my-generated-api-client
    ```
    Replace `./path/to/your/swagger.json` with the actual path to your Swagger definition and `./my-generated-api-client` with your desired output folder name.

2.  **Generated Project Structure:**
    The tool will create the specified output directory (e.g., `my-generated-api-client`) containing the following structure:

    ```
    my-generated-api-client/
    ├── src/
    │   ├── index.ts                     # Main index file re-exporting all modules
    │   └── modules/
    │       ├── [tagName1]/              # Module for each Swagger tag
    │       │   ├── [tagName1].service.ts       # Service implementation
    │       │   ├── [tagName1].presentation.ts  # React Query hooks
    │       │   └── domains/
    │       │       ├── models/         # TypeScript interfaces for models
    │       │       │   ├── ModelA.ts
    │       │       │   └── ModelB.ts
    │       │       └── I[TagName1]Service.ts  # Service interface
    │       └── [tagName2]/              # Another tag module
    │           └── ... (same structure as above)
    ├── package.json
    ├── tsconfig.json
    ├── README.md
    └── .gitignore
    ```

### Generated Code

*   **Models (`src/modules/[tag]/domains/models/`)**: TypeScript interfaces generated from your Swagger definitions. These are associated with tags based on usage in operations.
*   **Service Interfaces (`src/modules/[tag]/domains/I[TagName]Service.ts`)**: TypeScript interfaces defining method signatures for all operations belonging to that tag.
*   **Service Implementations (`src/modules/[tag]/[tag].service.ts`)**: TypeScript classes implementing the service interfaces, containing `axios` calls for each operation.
*   **Presentation Layer (`src/modules/[tag]/[tag].presentation.ts`)**: Objects containing React Query (`useQuery`/`useMutation`) hooks for each operation in the service.
*   **Main `src/index.ts`**: This file re-exports all generated tag modules for easy import.

## Configuration

*   **API Base URL**: You will need to configure the base URL for your API in your application. This is typically done by setting `axios.defaults.baseURL = 'YOUR_API_BASE_URL';` in a central configuration file before using the generated services. The generated service classes assume this configuration.
*   **React Query**: The generated hooks use `@tanstack/react-query`. Make sure it's installed in your frontend project (it's included in the generated `package.json`).

## Notes

*   Ensure your Swagger file is valid and uses tags for operations to get the best-organized output. If operations lack tags, they will be grouped under a default "General" tag.
*   The LLM generates code based on prompts; you might need to review and adjust the generated code, especially for complex or non-standard Swagger definitions.
*   Review the generated `README.md` and `package.json` within the output directory for additional details.
