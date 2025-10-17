# Swagger-to-Modules: User Manual

This tool converts a Swagger (OpenAPI) definition into a TypeScript frontend project, including service classes, interfaces, and React Query hooks, using an LLM.

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
    node dist/index.js --swagger-path ./path/to/your/swagger.json --output-dir ./generated-frontend-module
    ```
    Replace `./path/to/your/swagger.json` with the actual path to your Swagger definition and `./generated-frontend-module` with your desired output folder name.

2.  **Generated Project:**
    The tool will create the specified output directory (e.g., `generated-frontend-module`) containing:
    *   `src/models/`: TypeScript interfaces for your API data.
    *   `src/services/`: Service classes using `axios` for API calls.
    *   `src/hooks/`: React Query hooks for data fetching and mutation.
    *   `package.json`: Project dependencies and scripts.
    *   `tsconfig.json`: TypeScript configuration.

## Notes

*   Ensure your Swagger file is valid.
*   The LLM might generate code that requires minor adjustments depending on the complexity of your API.
*   Review the generated code in your output directory.
