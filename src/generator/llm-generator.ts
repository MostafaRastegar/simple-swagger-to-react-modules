const axios = require("axios");

// Import types from global-types.ts
import type {
  SwaggerParameter,
  SwaggerResponse,
  SwaggerOperation,
  SwaggerPathItem,
  SwaggerDefinition,
  ParsedSwaggerData,
} from "../global-types";

// Type definitions for associated operations
import type { AssociatedOperation } from "../global-types";

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
    this.model = "deepseek/deepseek-r1:free";
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/your-repo/swagger-to-modules",
        "X-Title": "Swagger to Modules Agent",
      },
    });
  }

  /**
   * Prepares a prompt for generating a list of tags from Swagger data.
   * @param {ParsedSwaggerData} swaggerData - Parsed Swagger data.
   * @returns {string} The formatted prompt.
   */
  generateTagListPrompt(swaggerData: ParsedSwaggerData): string {
    const allTags = new Set<string>();
    const tagDescriptions: Record<string, string[]> = {};

    // Iterate through paths and operations to gather tags and their descriptions
    if (swaggerData.paths) {
      Object.entries(swaggerData.paths).forEach(([path, pathItem]) => {
        if (pathItem && typeof pathItem === "object") {
          Object.entries(pathItem).forEach(([method, operation]) => {
            if (
              method &&
              [
                "get",
                "post",
                "put",
                "delete",
                "patch",
                "head",
                "options",
              ].includes(method) &&
              operation &&
              typeof operation === "object" &&
              operation.operationId
            ) {
              const op = operation as SwaggerOperation;
              if (op.tags && op.tags.length > 0) {
                op.tags.forEach((tag) => {
                  allTags.add(tag);
                  if (!tagDescriptions[tag]) {
                    tagDescriptions[tag] = [];
                  }
                  if (op.summary) {
                    tagDescriptions[tag].push(
                      `${method.toUpperCase()} ${path}: ${op.summary}`
                    );
                  }
                });
              }
              // If no tags, create a generic one based on operationId or path
              if (!op.tags || op.tags.length === 0) {
                const genericTag = op.operationId
                  ? op.operationId.split("_")[0]
                  : path.split("/")[1];
                const tagName = genericTag
                  ? genericTag.charAt(0).toUpperCase() + genericTag.slice(1)
                  : "Untagged";
                allTags.add(tagName);
                if (!tagDescriptions[tagName]) {
                  tagDescriptions[tagName] = [];
                }
                if (op.summary) {
                  tagDescriptions[tagName].push(
                    `${method.toUpperCase()} ${path}: ${op.summary}`
                  );
                } else {
                  tagDescriptions[tagName].push(
                    `${method.toUpperCase()} ${path}`
                  );
                }
              }
            }
          });
        }
      });
    }

    const tagList = Array.from(allTags)
      .map((tag) => {
        const descriptions = tagDescriptions[tag] || [];
        const uniqueDescriptions = [...new Set(descriptions)]; // Remove duplicate descriptions for the same tag
        return `- **${tag}**\n  ${
          uniqueDescriptions.join("\n  ") ||
          "No specific operations found or described for this tag."
        }`;
      })
      .join("\n\n");

    return `
You are an expert API analyst.

Given the following Swagger data:

\`\`\`json
${JSON.stringify(swaggerData, null, 2)}
\`\`\`

Analyze the provided Swagger data and extract a comprehensive list of all unique tags.
For each tag, provide a brief description summarizing the kind of operations typically associated with it. You can infer this from the 'summary' or 'description' fields of the operations under each tag.

Present the output as a numbered list, where each item is the tag name followed by its description.
If a tag has no operations or descriptions clearly associated with it, you can state that.

Example Output:
1. **User Management**
   - GET /users: Retrieves a list of users.
   - POST /users: Creates a new user.
2. **Product Catalog**
   - GET /products: Lists all products.
   - GET /products/{id}: Fetches a specific product.

Tags:
${tagList}
`;
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
          (propDetails.$ref ? propDetails.$ref.split("/").pop() : "any");
        const description = propDetails.description
          ? `/** ${propDetails.description} */\n  `
          : "";

        if (propDetails.type === "array" && propDetails.items) {
          const itemsType =
            propDetails.items.type ||
            (propDetails.items.$ref
              ? propDetails.items.$ref.split("/").pop()
              : "any");
          return `${description}${propName}${optionalStr}: ${itemsType}[];`;
        }
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
   * Generates a descriptive method name from an operation.
   */
  generateMethodName(
    path: string,
    method: string,
    operation: SwaggerOperation
  ): string {
    const cleanPath = path.replace(/^\/|\/$/g, "").replace(/\/|-/g, "_");
    const operationId = operation.operationId || `${method}_${cleanPath}`;
    return operationId
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word: string, index: number) => {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
      })
      .replace(/\s+/g, "");
  }

  /**
   * Determines the return type for a service method based on Swagger responses.
   */
  determineServiceMethodReturnType(operation: SwaggerOperation): string {
    if (!operation.responses || Object.keys(operation.responses).length === 0) {
      return "any";
    }

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
        return successfulResponse.schema.$ref.split("/").pop() as string;
      }
      if (successfulResponse.schema.type) {
        if (
          successfulResponse.schema.type === "object" &&
          !successfulResponse.schema.properties
        ) {
          return "Record<string, any>";
        }
        if (
          successfulResponse.schema.type === "object" &&
          successfulResponse.schema.properties
        ) {
          return "Record<string, any>";
        }
        return successfulResponse.schema.type;
      }
    }
    return "any";
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
      array: "any[]",
      object: "Record<string, any>",
      file: "File",
      date: "string",
      "date-time": "string",
      password: "string",
      email: "string",
    };
    return typeMap[swaggerType] || "any";
  }

  /**
   * Prepares a prompt for generating a service interface for a given tag.
   * @param {ParsedSwaggerData} swaggerData - Parsed Swagger data.
   * @param {string} tagName - The name of the tag.
   * @param {AssociatedOperation[]} operations - Operations associated with this tag.
   * @returns {string} The formatted prompt.
   */
  generateServiceInterfacePrompt(
    swaggerData: ParsedSwaggerData,
    tagName: string,
    operations: AssociatedOperation[]
  ): string {
    const methodSignatures = operations
      .map((op) => {
        const returnType = this.determineServiceMethodReturnType(op.operation);
        const paramsStr = this.generateMethodParams(op.operation);
        const pathSegments = op.path
          .split("/")
          .map((segment) =>
            segment.startsWith("{")
              ? `By${segment.slice(1, -1)}`
              : segment.charAt(0).toUpperCase() + segment.slice(1)
          )
          .join("");
        const methodName = `${op.method}${pathSegments}`;
        return `  ${methodName}(${paramsStr}): Promise<${returnType}>;`;
      })
      .join("\n");

    const operationsList = operations
      .map(
        (op) =>
          `- ${op.method.toUpperCase()} ${op.path}: ${
            op.operation.summary || "No summary"
          }`
      )
      .join("\n");

    return `
You are an expert TypeScript developer.

Given the following Swagger operations for the "${tagName}" tag:

${operationsList}

Generate a TypeScript interface named \`I${tagName}Service\`.
This interface should contain method signatures for all the operations listed above.
Use \`axios\` for the HTTP request types (e.g., \`Promise<T>\` for return types).
Assume base URL is configured elsewhere.
Parameters should be typed based on Swagger definitions.

Provide only the TypeScript interface code, no explanations or markdown code block formatting.
Example:
export interface IMyService {
  getResource(id: number): Promise<MyData>;
  createResource(data: MyDataInput): Promise<MyData>;
}
export interface I${tagName}Service {
${methodSignatures}
}
`;
  }

  /**
   * Prepares a prompt for generating a service implementation for a given tag.
   * @param {ParsedSwaggerData} swaggerData - Parsed Swagger data.
   * @param {string} tagName - The name of the tag.
   * @param {AssociatedOperation[]} operations - Operations associated with this tag.
   * @param {string} serviceInterfaceCode - The generated service interface code for context.
   * @returns {string} The formatted prompt.
   */
  generateServiceImplementationPrompt(
    swaggerData: ParsedSwaggerData,
    tagName: string,
    operations: AssociatedOperation[],
    serviceInterfaceCode: string
  ): string {
    const methodImplementations = operations
      .map((op) => {
        const pathSegments = op.path
          .split("/")
          .map((segment) =>
            segment.startsWith("{")
              ? `By${segment.slice(1, -1)}`
              : segment.charAt(0).toUpperCase() + segment.slice(1)
          )
          .join("");
        const methodName = `${op.method}${pathSegments}`;
        const paramsStr = this.generateMethodParams(op.operation);
        const returnType = this.determineServiceMethodReturnType(op.operation);
        const consumes =
          op.operation.consumes && op.operation.consumes.length > 0
            ? op.operation.consumes[0]
            : "application/json";

        const urlPathParams = this.generateUrlPathParams(op.operation);
        const axiosConfig = this.generateAxiosConfig(op.operation, consumes);

        const axiosCall = `axios.${op.method}(\`\${this.getBaseUrl()}${op.path}${urlPathParams}\`, ${axiosConfig})`;

        return `  async ${methodName}(${paramsStr}): Promise<${returnType}> {
    try {
      const response = await ${axiosCall};
      return response.data;
    } catch (error) {
      console.error(\`Error in ${methodName}:\`, error);
      throw error;
    }
  }`;
      })
      .join("\n\n");

    const operationsList = operations
      .map(
        (op) =>
          `- ${op.method.toUpperCase()} ${op.path}: ${
            op.operation.summary || "No summary"
          }`
      )
      .join("\n");

    return `
You are an expert TypeScript developer and API integration specialist.

Given the following Swagger operations for the "${tagName}" tag and the service interface:

Operations:
${operationsList}

Service Interface (for reference):
\`\`\`typescript
${serviceInterfaceCode}
\`\`\`

Generate a TypeScript class named \`${tagName}Service\` that implements the \`I${tagName}Service\` interface.
Each method in the class should make an HTTP request using \`axios\`.
Set the \`Content-Type\` header appropriately.
Handle potential errors using a try...catch block.
For successful responses, assume data is in the response.data property.
You can assume a \`getBaseUrl()\` method is available on the class or \`axios.defaults.baseURL\` is set.

Provide only the TypeScript class code that implements the interface, no explanations or markdown code block formatting.
Example:
export class MyService implements IMyService {
  async getResource(id: number): Promise<MyData> {
    // implementation
  }
}
export class ${tagName}Service implements I${tagName}Service {
${methodImplementations}
}
`;
  }

  /**
   * Prepares a prompt for generating React Query hooks for a given tag.
   * @param {ParsedSwaggerData} swaggerData - Parsed Swagger data.
   * @param {string} tagName - The name of the tag.
   * @param {AssociatedOperation[]} operations - Operations associated with this tag.
   * @param {string} serviceInterfaceCode - The generated service interface code for context.
   * @returns {string} The formatted prompt.
   */
  generatePresentationLayerPrompt(
    swaggerData: ParsedSwaggerData,
    tagName: string,
    operations: AssociatedOperation[],
    serviceInterfaceCode: string
  ): string {
    const hookDefinitions = operations
      .map((op) => {
        const pathSegments = op.path
          .split("/")
          .map((segment) =>
            segment.startsWith("{")
              ? `By${segment.slice(1, -1)}`
              : segment.charAt(0).toUpperCase() + segment.slice(1)
          )
          .join("");
        const methodName = `${op.method}${pathSegments}`;
        const isMutation = ["post", "put", "delete", "patch"].includes(
          op.method
        );
        const hookName = `use${isMutation ? "Mutate" : "Query"}${
          methodName.charAt(0).toUpperCase() + methodName.slice(1)
        }`;
        const queryKeyBase = JSON.stringify([
          `${tagName.toLowerCase()}`,
          op.method,
          op.path,
        ]);

        if (isMutation) {
          return `  ${hookName}: (variables?: any) => useMutation({
    mutationFn: () => new ${tagName}Service().${methodName}(variables),
    onSuccess: (data) => { console.log('${methodName} success:', data); },
    onError: (error) => { console.error('${methodName} error:', error); },
  }),`;
        } else {
          const pathParams =
            op.operation.parameters?.filter(
              (p: SwaggerParameter) => p.in === "path"
            ) || [];
          const queryParams =
            op.operation.parameters?.filter(
              (p: SwaggerParameter) => p.in === "query"
            ) || [];
          const hasParams = pathParams.length > 0 || queryParams.length > 0;

          let queryFnArgs = "";
          let queryFnCall = `new ${tagName}Service().${methodName}()`;
          if (hasParams) {
            const paramNames = [...pathParams, ...queryParams].map(
              (p) => p.name
            );
            if (paramNames.length > 0) {
              queryFnArgs = `(${paramNames.join(", ")}: any)`;
              queryFnCall = `new ${tagName}Service().${methodName}(${paramNames.join(
                ", "
              )})`;
            }
          }
          const queryKey = hasParams
            ? `${queryKeyBase}, variables`
            : queryKeyBase;

          return `  ${hookName}: (${queryFnArgs}) => useQuery({
    queryKey: ${queryKey},
    queryFn: ${queryFnArgs} => ${queryFnCall},
  }),`;
        }
      })
      .join("\n");

    const operationsList = operations
      .map(
        (op) =>
          `- ${op.method.toUpperCase()} ${op.path}: ${
            op.operation.summary || "No summary"
          }`
      )
      .join("\n");

    return `
You are an expert React and React Query developer.

Given the following Swagger operations for the "${tagName}" tag and the service interface:

Operations:
${operationsList}

Service Interface (for reference):
\`\`\`typescript
${serviceInterfaceCode}
\`\`\`

Generate a set of React Query hooks for the \`${tagName}\` module.
Create an object (e.g., \`${tagName}Presentation\`) that contains \`useQuery\` and \`useMutation\` hooks for each operation.
- For GET operations, generate a \`useQuery\` hook.
- For POST, PUT, DELETE, PATCH operations, generate a \`useMutation\` hook.
Name the hooks descriptively, e.g., \`useGetResources\`, \`useCreateResource\`.
Assume a class \`${tagName}Service\` (implementing \`I${tagName}Service\`) is available for API calls.
For mutations, include placeholder \`onSuccess\` and \`onError\` handlers.
For queries with parameters, include them in the query key and query function.

Provide only the TypeScript code for the hooks object, no explanations or markdown code block formatting.
Example:
export function UserPresentation() {
  return {
    useGetUsers: () => useQuery({ queryKey: ['users'], queryFn: () => userService.getUsers() }),
    useCreateUser: () => useMutation({ mutationFn: (userData) => userService.createUser(userData) }),
  };
}
export function ${tagName}Presentation() {
  return {
${hookDefinitions}
  };
}
`;
  }

  /**
   * Helper to generate parameter string for a method signature.
   * @param {SwaggerOperation} operation - The Swagger operation.
   * @returns {string} The parameter string.
   */
  private generateMethodParams(operation: SwaggerOperation): string {
    const pathParams = operation.parameters
      ? operation.parameters.filter((p: SwaggerParameter) => p.in === "path")
      : [];
    const queryParams = operation.parameters
      ? operation.parameters.filter((p: SwaggerParameter) => p.in === "query")
      : [];
    const headerParams = operation.parameters
      ? operation.parameters.filter((p: SwaggerParameter) => p.in === "header")
      : [];
    const bodyParam = operation.parameters
      ? operation.parameters.find((p: SwaggerParameter) => p.in === "body")
      : null;
    const formDataParam = operation.parameters
      ? operation.parameters.find((p: SwaggerParameter) => p.in === "formData")
      : null;

    let paramsStr: string[] = [];
    if (pathParams.length > 0) {
      paramsStr.push(
        pathParams
          .map(
            (p: SwaggerParameter) =>
              `${p.name}: ${this.mapSwaggerTypeToTs(
                p.type || (p.schema ? p.schema.type : "string")
              )}${p.required ? "" : "?"}`
          )
          .join(", ")
      );
    }
    if (queryParams.length > 0) {
      paramsStr.push(
        queryParams
          .map(
            (p: SwaggerParameter) =>
              `${p.name}: ${this.mapSwaggerTypeToTs(
                p.type || (p.schema ? p.schema.type : "string")
              )}${p.required ? "" : "?"}`
          )
          .join(", ")
      );
    }
    if (headerParams.length > 0) {
      paramsStr.push("customHeaders?: Record<string, string>");
    }
    if (bodyParam || formDataParam) {
      const bodySchema = bodyParam ? bodyParam.schema : formDataParam?.schema;
      const bodyTypeName = bodySchema
        ? bodySchema.$ref
          ? bodySchema.$ref.split("/").pop()
          : bodySchema.type || "any"
        : "any";
      paramsStr.push(
        `data: ${bodyTypeName}${bodyParam && !bodyParam.required ? "?" : ""}`
      );
    }
    return paramsStr.join(", ");
  }

  /**
   * Helper to generate URL path parameter string for axios calls.
   * @param {SwaggerOperation} operation - The Swagger operation.
   * @returns {string} The URL path parameters string (e.g., \`/${id}\`).
   */
  private generateUrlPathParams(operation: SwaggerOperation): string {
    const pathParams = operation.parameters
      ? operation.parameters.filter((p: SwaggerParameter) => p.in === "path")
      : [];
    if (pathParams.length === 0) {
      return "";
    }
    return pathParams.map((p: SwaggerParameter) => `/\${${p.name}}`).join("");
  }

  /**
   * Helper to generate axios config object for requests.
   * @param {SwaggerOperation} operation - The Swagger operation.
   * @param {string} consumes - The content type for the request.
   * @returns {string} The axios config string.
   */
  private generateAxiosConfig(
    operation: SwaggerOperation,
    consumes: string
  ): string {
    const hasBodyOrFormData =
      operation.parameters?.some(
        (p: SwaggerParameter) => p.in === "body" || p.in === "formData"
      ) || false;

    if (hasBodyOrFormData && consumes.includes("form")) {
      return `data, { headers: { 'Content-Type': '${consumes}' } }`;
    } else if (hasBodyOrFormData) {
      return `data, { headers: { 'Content-Type': 'application/json' } }`;
    } else {
      return `{ params: ${this.generateQueryParams(operation)} }`;
    }
  }

  /**
   * Helper to generate query parameters string for axios.
   * @param {SwaggerOperation} operation - The Swagger operation.
   * @returns {string} The query parameters string (e.g., \`{ params: { param1: value1 } }\`).
   */
  private generateQueryParams(operation: SwaggerOperation): string {
    const queryParams = operation.parameters
      ? operation.parameters.filter((p: SwaggerParameter) => p.in === "query")
      : [];
    if (queryParams.length === 0) {
      return "{}";
    }
    const paramsObjStr = queryParams
      .map((p: SwaggerParameter) => `${p.name}: ${p.name}`) // Assumes param names are valid JS identifiers
      .join(", ");
    return `{ ${paramsObjStr} }`;
  }

  /**
   * Placeholder for getBaseUrl, to be implemented or assumed to be set on axios instance.
   */
  private getBaseUrl(): string {
    // This could be configurable or come from an instance property.
    // For now, return empty string assuming axios.defaults.baseURL is used.
    return "";
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
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
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
