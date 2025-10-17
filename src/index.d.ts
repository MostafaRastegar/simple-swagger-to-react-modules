// Type declarations for local TypeScript modules
declare module "./parser/swagger-parser" {
  export function parseSwagger(swaggerFilePath: string): Promise<any>;
  export { parseSwagger as default };
}

declare module "./generator/llm-generator" {
  export class LLMGenerator {
    constructor(apiKey: string, model?: string, baseUrl?: string);
    generateInterfacePrompt(swaggerData: any, definitionName: string): string;
    generateServiceMethodPrompt(
      swaggerData: any,
      path: string,
      method: string,
      operation: any
    ): string;
    generateCode(prompt: string): Promise<string>;
  }
  export { LLMGenerator as default };
}

declare module "./writer/file-writer" {
  export class FileWriter {
    constructor(outputDir?: string);
    writeTsFile(relativePath: string, content: string): void;
    writeTsFiles(files: Record<string, string>): void;
    writePackageJson(packageJsonData: any): void;
    writeTsConfigJson(tsConfigData: any): void;
    writeReadme(projectName: string, description?: string): void;
    writeIndexFile(options: { models?: string[]; services?: string[] }): void;
    writeGitignore(): void;
  }
  export { FileWriter as default };
}
