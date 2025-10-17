import * as fs from "fs";

export function parseSwagger(path: string) {
  try {
    const data = fs.readFileSync(path, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to parse Swagger file:", e);
    return null;
  }
}
