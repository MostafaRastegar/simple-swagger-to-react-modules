"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateHandler = generateHandler;
function generateHandler(argv) {
    const specPath = argv.specPath;
    const { parseSwagger } = require("../parser/swagger");
    const { generateModule } = require("../generator/module");
    const fs = require("fs");
    const path = require("path");
    console.log("Generating modules from:", specPath);
    const spec = parseSwagger(specPath);
    const output = generateModule(spec);
    const outPath = path.join(process.cwd(), "generated");
    if (!fs.existsSync(outPath)) {
        fs.mkdirSync(outPath);
    }
    const fileOut = path.join(outPath, "module.ts");
    fs.writeFileSync(fileOut, output, "utf-8");
    console.log("Module written to:", fileOut);
}
