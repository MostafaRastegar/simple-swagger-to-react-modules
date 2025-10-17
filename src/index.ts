#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { version } from "../package.json";

yargs(hideBin(process.argv))
  .version(version)
  .command(
    "generate [specPath]",
    "Generate API modules from Swagger specification",
    (yargs) => {
      yargs.positional("specPath", {
        describe: "Path to Swagger JSON file",
        type: "string",
        default: "swagger.json",
      });
    },
    (argv) => {
      const specPath = argv.specPath as string;
      const { generateHandler } = require("./cli/generate");
      generateHandler({ specPath });
    }
  )
  .parse();
