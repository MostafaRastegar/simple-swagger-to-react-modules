const axios = require("axios");

// Import types from global-types.ts
import type {
  SwaggerParameter,
  SwaggerResponse,
  SwaggerOperation,
  SwaggerPathItem, // Although not directly used here, it's good to import if it's part of the main Swagger types
  SwaggerDefinition,
  ParsedSwaggerData, // Using the main ParsedSwaggerData
} from "../global-types";

// Type definitions for LLMGenerator methods
interface CodeGenerationResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface LLMConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

interface LLMClientConfig {
  baseURL: string;
  headers: {
    Authorization: string;
    "Content-Type": string;
    "HTTP-Referer": string;
    "X-Title": string;
  };
}

/**
 * Generates code using an LLM via OpenRouter API.
 */
class LLMGenerator {
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private client: import("axios").AxiosInstance;

  constructor(
    apiKey: string,
    model: string = "z-ai/glm-4.5-air:free",
    baseUrl: string = "https://openrouter.ai/api/v1"
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/your-repo/swagger-to-modules", // Replace with your actual repo
        "X-Title": "Swagger to Modules Agent",
      },
    });
  }

  /**
   * Prepares a prompt for generating TypeScript interfaces from Swagger definitions.
   * @param {ParsedSwaggerData} swaggerData - Parsed Swagger data.
   * @param {string} definitionName - The name of the definition to generate an interface for.
   * @returns {string} The formatted prompt.
   */
  generateInterfacePrompt(
    swaggerData: ParsedSwaggerData,
    definitionName: string
  ): string {
    const definition = swaggerData.definitions?.[definitionName];
    if (!definition) {
      throw new Error(
        `Definition '${definitionName}' not found in Swagger data.`
      );
    }

    const propertiesStr = Object.entries(definition.properties || {})
      .map(([propName, propDetails]: [string, any]) => {
        const requiredFields = definition.required || [];
        const isRequired = requiredFields.includes(propName);
        const optionalStr = isRequired ? "" : "?";
        const type =
          propDetails.type ||
          (propDetails.$ref ? propDetails.$ref.split("/").pop() : "any"); // Handle $ref for other definitions
        const description = propDetails.description
          ? `/** ${propDetails.description} */\n  `
          : "";

        // Handle array types
        if (propDetails.type === "array" && propDetails.items) {
          const itemsType =
            propDetails.items.type ||
            (propDetails.items.$ref
              ? propDetails.items.$ref.split("/").pop()
              : "any");
          return `${description}${propName}${optionalStr}: ${itemsType}[];`;
        }
        // Handle object types without explicit properties (or complex ones not fully defined here)
        if (propDetails.type === "object" && !propDetails.properties) {
          return `${description}${propName}${optionalStr}: Record<string, any>;`;
        }

        return `${description}${propName}${optionalStr}: ${type};`;
      })
      .join("\n    ");

    return `
You are an expert TypeScript developer.

Given the following Swagger definition for "${definitionName}":

\`\`\`json
${JSON.stringify(definition, null, 2)}
\`\`\`

Generate a TypeScript interface for "${definitionName}".
The interface should be named \`${definitionName}\`.
Ensure all properties are correctly typed.
Use '?' for optional properties.
Include JSDoc comments for descriptions if provided in the schema.

Provide only the TypeScript interface code, no explanations or markdown code block formatting.
Example:
export interface MyModel {
  id: number;
  name?: string;
  // ... other properties
}
export interface ${definitionName} {
${propertiesStr}
}
`;
  }

  /**
   * Prepares a prompt for generating a service class method from a Swagger operation.
   * @param {ParsedSwaggerData} swaggerData - Parsed Swagger data.
   * @param {string} path - The API path.
   * @param {string} method - The HTTP method (lowercase).
   * @param {SwaggerOperation} operation - The operation object.
   * @returns {string} The formatted prompt.
   */
  generateServiceMethodPrompt(
    swaggerData: ParsedSwaggerData,
    path: string,
    method: string,
    operation: SwaggerOperation
  ): string {
    const pathParams = operation.parameters
      ? operation.parameters.filter((p: SwaggerParameter) => p.in === "path")
      : [];
    const queryParams = operation.parameters
      ? operation.parameters.filter((p: SwaggerParameter) => p.in === "query")
      : [];
    const headerParams = operation.parameters
      ? operation.parameters.filter((p: SwaggerParameter) => p.in === "header")
      : [];
    // For simplicity, assuming body parameter is for 'post', 'put', 'patch'
    // and there's typically one body parameter or it's form data
    const bodyParam = operation.parameters
      ? operation.parameters.find((p: SwaggerParameter) => p.in === "body")
      : null;
    const formDataParam = operation.parameters
      ? operation.parameters.find((p: SwaggerParameter) => p.in === "formData")
      : null;

    const methodName = this.generateMethodName(path, method, operation);
    const returnType = this.determineServiceMethodReturnType(operation);

    let paramsStr = "";
    if (pathParams.length > 0) {
      paramsStr += pathParams
        .map(
          (p: SwaggerParameter) =>
            `${p.name}: ${this.mapSwaggerTypeToTs(
              p.type || (p.schema ? p.schema.type : "string")
            )}${
              p.required
                ? ""
                : " = " /*TODO: provide default or make optional */
            }`
        )
        .join(", ");
      if (
        queryParams.length > 0 ||
        headerParams.length > 0 ||
        bodyParam ||
        formDataParam
      )
        paramsStr += ", ";
    }
    if (queryParams.length > 0) {
      paramsStr += queryParams
        .map(
          (p: SwaggerParameter) =>
            `${p.name}: ${this.mapSwaggerTypeToTs(
              p.type || (p.schema ? p.schema.type : "string")
            )}${
              p.required
                ? ""
                : " = " /*TODO: provide default or make optional */
            }`
        )
        .join(", ");
      if (headerParams.length > 0 || bodyParam || formDataParam)
        paramsStr += ", ";
    }
    if (headerParams.length > 0) {
      // Example: headers: { 'Content-Type': 'application/json' }
      // Or more dynamically: customHeaders?: Record<string, string>
      paramsStr += "customHeaders?: Record<string, string>, ";
    }
    if (bodyParam || formDataParam) {
      const bodySchema = bodyParam
        ? bodyParam.schema
        : formDataParam
        ? formDataParam.schema
        : null;
      const bodyTypeName = bodySchema
        ? bodySchema.$ref
          ? bodySchema.$ref.split("/").pop()
          : bodySchema.type || "any"
        : "any";
      paramsStr += `data: ${bodyTypeName}${
        bodyParam && !bodyParam.required ? "?" : ""
      }`;
    }

    const consumes =
      operation.consumes && operation.consumes.length > 0
        ? operation.consumes[0]
        : "application/json";
    const produces =
      operation.produces && operation.produces.length > 0
        ? operation.produces[0]
        : "application/json";

    return `
You are an expert TypeScript developer and API integration specialist.

Given the following Swagger operation details:

Path: \`${path}\`
Method: \`${method.toUpperCase()}\`
Summary: \`${operation.summary || ""}\`
Description: \`${operation.description || ""}\`

Parameters:
${
  operation.parameters
    ? operation.parameters
        .map(
          (p: SwaggerParameter) =>
            `- \`${p.name}\` (${p.in}): ${
              p.description || "No description"
            }, Type: ${
              p.type || (p.schema ? p.schema.type : "string")
            }, Required: ${p.required || false}`
        )
        .join("\n")
    : "None"
}

Body/FormData Schema:
${
  bodyParam
    ? JSON.stringify(bodyParam.schema, null, 2)
    : formDataParam
    ? JSON.stringify(formDataParam.schema, null, 2)
    : "None"
}

Response Example (if available in schema):
${
  operation.responses &&
  operation.responses["200"] &&
  operation.responses["200"].schema
    ? JSON.stringify(operation.responses["200"].schema, null, 2)
    : "N/A"
}

Generate a TypeScript method for an API service class.
Method Name: \`${methodName}\`
Parameters: (${paramsStr})
Return Type: \`${returnType}\`
Use \`axios\` for the HTTP request.
Assume base URL is configured elsewhere (e.g., \`axios.defaults.baseURL\`).
Set the \`Content-Type\` header appropriately based on \`${consumes}\`.
Handle potential errors using a try...catch block and return a rejected promise or throw an error.
For responses, assume successful data is in the response.data property (e.g., \`response.data\` for axios).

Provide only the TypeScript method code, no explanations or markdown code block formatting.
Example:
async getMyResource(id: number): Promise<MyData> {
  try {
    const response = await axios.get(\`/my-resource/\${id}\`);
    return response.data;
  } catch (error) {
    console.error("Error fetching my resource:", error);
    throw error;
  }
}
async ${methodName}(${paramsStr}): Promise<${returnType}> {
  // Your implementation here
}
`;
  }

  /**
   * Generates a descriptive method name from an operation.
   */
  generateMethodName(
    path: string,
    method: string,
    operation: SwaggerOperation
  ): string {
    // Sanitize path: remove leading '/', replace '/' and '-' with '_', remove trailing '/'
    const cleanPath = path.replace(/^\/|\/$/g, "").replace(/\/|-/g, "_");
    // Use operation ID if available, otherwise generate from path and method
    const operationId = operation.operationId || `${method}_${cleanPath}`;
    // CamelCase the operationId
    return operationId
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word: string, index: number) => {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
      })
      .replace(/\s+/g, "");
  }

  /**
   * Determines the return type for a service method based on Swagger responses.
   * For simplicity, this will often be a Promise of the primary response data type.
   */
  determineServiceMethodReturnType(operation: SwaggerOperation): string {
    // Default to any
    if (!operation.responses || Object.keys(operation.responses).length === 0) {
      return "any";
    }

    // Typically '200' is the success status, but could be '201', '204', etc.
    // For now, let's assume the first 2xx response or '200' as primary.
    const successfulResponseEntry: [string, SwaggerResponse] | undefined =
      Object.entries(operation.responses).find(([status]) =>
        status.startsWith("2")
      ) as [string, SwaggerResponse] | undefined;
    const successfulResponse: SwaggerResponse | undefined =
      successfulResponseEntry
        ? operation.responses[successfulResponseEntry[0]]
        : operation.responses["200"];

    if (successfulResponse && successfulResponse.schema) {
      if (
        successfulResponse.schema.type === "array" &&
        successfulResponse.schema.items
      ) {
        const itemsType =
          successfulResponse.schema.items.type ||
          (successfulResponse.schema.items.$ref
            ? successfulResponse.schema.items.$ref.split("/").pop()
            : "any");
        return `${itemsType}[]`;
      }
      if (successfulResponse.schema.$ref) {
        return successfulResponse.schema.$ref.split("/").pop() as string; // Get type from $ref
      }
      if (successfulResponse.schema.type) {
        // Handle basic types and objects
        if (
          successfulResponse.schema.type === "object" &&
          !successfulResponse.schema.properties
        ) {
          return "Record<string, any>"; // Generic object
        }
        if (
          successfulResponse.schema.type === "object" &&
          successfulResponse.schema.properties
        ) {
          // This is a simplification; ideally, it would map to a specific interface name
          // For now, returning 'any' or 'Record<string, any>' for complex objects without a direct $ref
          return "Record<string, any>"; // Or a more specific type if mappings are known
        }
        return successfulResponse.schema.type;
      }
    }
    return "any"; // Default fallback
  }

  /**
   * Maps Swagger primitive types to TypeScript types.
   */
  mapSwaggerTypeToTs(swaggerType: string): string {
    const typeMap: Record<string, string> = {
      integer: "number",
      int: "number",
      float: "number",
      double: "number",
      string: "string",
      boolean: "boolean",
      array: "any[]", // Simplified, items type should be handled
      object: "Record<string, any>",
      file: "File", // Or Blob, depending on client capabilities
      date: "string", // Or Date, if parsing is handled
      "date-time": "string", // Or Date
      password: "string",
      email: "string",
    };
    return typeMap[swaggerType] || "any";
  }

  /**
   * Sends a prompt to the LLM and returns the generated code.
   * @param {string} prompt - The prompt to send.
   * @returns {Promise<string>} The generated code.
   */
  async generateCode(prompt: string): Promise<string> {
    try {
      const response = await this.client.post("/chat/completions", {
        model: this.model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        // Optional: Adjust temperature, max tokens, etc.
        temperature: 0.2, // Lower temperature for more deterministic code generation
        max_tokens: 2048,
      });
      const generatedCode = response.data.choices[0].message.content.trim();
      return generatedCode;
    } catch (error: any) {
      console.error(
        "Error generating code with LLM:",
        error.response ? error.response.data : error.message
      );
      throw new Error(
        `LLM code generation failed: ${
          error.response ? error.response.data.error.message : error.message
        }`
      );
    }
  }
}

module.exports = LLMGenerator;
