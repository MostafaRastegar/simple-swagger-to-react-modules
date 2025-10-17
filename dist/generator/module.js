"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateModule = generateModule;
function generateModule(spec) {
    if (!spec)
        return "";
    const content = `export const swaggerSpec = ${JSON.stringify(spec, null, 2)};`;
    return content;
}
