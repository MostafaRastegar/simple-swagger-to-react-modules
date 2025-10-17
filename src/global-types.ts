// Type definitions for Swagger components
export interface SwaggerParameter {
  name: string;
  in: "query" | "header" | "path" | "body" | "formData";
  description?: string;
  required?: boolean;
  type?: string;
  schema?: any;
  example?: any;
}

export interface SwaggerResponse {
  description?: string;
  schema?: any;
  examples?: any;
}

export interface SwaggerOperation {
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: SwaggerParameter[];
  consumes?: string[];
  produces?: string[];
  responses?: Record<string, SwaggerResponse>;
  security?: any;
  operationId?: string;
}

export interface SwaggerPathItem {
  // More flexible approach to allow dynamic access to HTTP methods
  [key: string]: SwaggerOperation | undefined;
}

export interface SwaggerDefinition {
  type?: string;
  properties?: Record<string, any>;
  required?: string[];
  description?: string;
  example?: any;
}

export interface ParsedSwaggerData {
  swaggerVersion?: string;
  host?: string;
  basePath?: string;
  schemes?: string[];
  consumes?: string[];
  produces?: string[];
  paths: Record<string, SwaggerPathItem>;
  definitions: Record<string, SwaggerDefinition>;
  tags?: Array<{ name: string; description?: string }>;
  securityDefinitions?: Record<string, any>;
}

// Type definitions for FileWriter
export interface PackageJsonConfig {
  name?: string;
  version?: string;
  description?: string;
  main?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  // Add other relevant fields as needed
}

export interface TsConfigConfig {
  compilerOptions: {
    target?: string;
    module?: string;
    outDir?: string;
    rootDir?: string;
    strict?: boolean;
    esModuleInterop?: boolean;
    skipLibCheck?: boolean;
    forceConsistentCasingInFileNames?: boolean;
    // Add other relevant options
  };
  include?: string[];
  exclude?: string[];
  // Add other relevant fields
}

// Add other global types as needed
