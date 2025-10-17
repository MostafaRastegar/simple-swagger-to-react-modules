#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const package_json_1 = require("../package.json");
(0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
    .version(package_json_1.version)
    .command("generate [specPath]", "Generate API modules from Swagger specification", (yargs) => {
    yargs.positional("specPath", {
        describe: "Path to Swagger JSON file",
        type: "string",
        default: "swagger.json",
    });
}, (argv) => {
    const specPath = argv.specPath;
    const { generateHandler } = require("./cli/generate");
    generateHandler({ specPath });
})
    .parse();
