const swaggerParser = require("@apidevtools/swagger-parser");

// Import types from global-types.ts
import type {
  SwaggerOperation,
  SwaggerPathItem,
  SwaggerDefinition,
  SwaggerResponse, // Added SwaggerResponse
} from "../global-types";

// Import ParsedSwaggerData from global-types.ts
import type { ParsedSwaggerData } from "../global-types";

/**
 * Parses a Swagger JSON file and extracts relevant information.
 * @param {string} swaggerFilePath - Path to the Swagger JSON file.
 * @returns {Promise<ParsedSwaggerData>} - A promise that resolves to an object containing parsed Swagger data.
 */
async function parseSwagger(
  swaggerFilePath: string
): Promise<ParsedSwaggerData> {
  try {
    const api: any = await swaggerParser.validate(swaggerFilePath);
    console.log("Swagger file parsed successfully.");

    const parsedData: ParsedSwaggerData = {
      swaggerVersion: api.swagger,
      host: api.host,
      basePath: api.basePath || "",
      schemes: api.schemes || ["http"],
      consumes: api.consumes || ["application/json"],
      produces: api.produces || ["application/json"],
      paths: {},
      definitions: {},
      tags: [],
      securityDefinitions: api.securityDefinitions || {},
    };

    // Extract tags
    if (Array.isArray(api.tags)) {
      parsedData.tags = api.tags.map((tag: any) => ({
        name: tag.name || "UnknownTag",
        description: tag.description || "",
      }));
    }

    // Extract paths and operations
    if (api.paths) {
      for (const [path, pathItemObj] of Object.entries(api.paths)) {
        if (typeof pathItemObj === "object" && pathItemObj !== null) {
          // Create a new SwaggerPathItem (which is a Record<string, SwaggerOperation | undefined>)
          const pathItem: SwaggerPathItem = {};
          for (const [method, operation] of Object.entries(
            pathItemObj as any
          )) {
            const methodLower = method.toLowerCase();
            if (
              [
                "get",
                "post",
                "put",
                "delete",
                "patch",
                "head",
                "options",
              ].includes(methodLower)
            ) {
              const op: any = operation;
              const operationData: SwaggerOperation = {
                summary: op.summary || "",
                description: op.description || "",
                tags: Array.isArray(op.tags) ? op.tags : [],
                parameters: Array.isArray(op.parameters)
                  ? op.parameters.map((param: any) => ({
                      name: param.name,
                      in: param.in as
                        | "query"
                        | "header"
                        | "path"
                        | "body"
                        | "formData", // Cast to specific 'in' type
                      description: param.description || "",
                      required: Boolean(param.required),
                      type:
                        param.type ||
                        (param.schema ? (param.schema as any).type : "string"),
                      schema: param.schema || undefined, // Match SwaggerParameter schema type
                      example: param.example,
                    }))
                  : [],
                consumes: Array.isArray(op.consumes)
                  ? op.consumes
                  : parsedData.consumes,
                produces: Array.isArray(op.produces)
                  ? op.produces
                  : parsedData.produces,
                responses: op.responses
                  ? Object.entries(op.responses).reduce(
                      (acc, [statusCode, response]: [string, any]) => {
                        acc[statusCode] = {
                          description: response.description || "",
                          schema: response.schema || undefined, // Match SwaggerResponse schema type
                          examples: response.examples || undefined,
                        };
                        return acc;
                      },
                      {} as Record<string, SwaggerResponse>
                    )
                  : {},
                security: op.security || undefined,
                operationId: op.operationId || undefined, // Ensure operationId is present
              };
              pathItem[methodLower] = operationData;
            }
          }
          parsedData.paths[path] = pathItem;
        }
      }
    }

    // Extract definitions (models)
    if (api.definitions) {
      for (const [definitionName, definition] of Object.entries(
        api.definitions
      )) {
        const def: any = definition;
        parsedData.definitions[definitionName] = {
          type: def.type || "object",
          properties: def.properties || {},
          description: def.description || "",
          required: Array.isArray(def.required) ? def.required : [],
          example: def.example,
        };
      }
    }

    return parsedData;
  } catch (error) {
    console.error("Error parsing Swagger file:", error);
    throw error;
  }
}

module.exports = {
  parseSwagger,
};
