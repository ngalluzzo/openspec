#!/usr/bin/env bun
import { parseArgs, toCliOptions } from "./args.js";
import { run } from "./run.js";

const args = parseArgs(process.argv.slice(2));
const options = toCliOptions(args);

const { exitCode } = await run(options);
process.exit(exitCode);
