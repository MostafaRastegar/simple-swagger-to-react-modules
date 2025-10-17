import Handlebars from "handlebars";
import * as fs from "fs";
import * as path from "path";

export function renderTemplate(templatePath: string, data: any): string {
  const templateContent = fs.readFileSync(templatePath, "utf-8");
  const tmpl = Handlebars.compile(templateContent);
  return tmpl(data);
}
