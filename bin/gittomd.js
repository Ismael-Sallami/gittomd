#!/usr/bin/env node
import { main } from "../src/node/cli.js";

const [major] = process.versions.node.split(".").map(Number);
if (major < 18) {
  process.stderr.write("gittomd needs Node.js 18 or newer (you have " + process.versions.node + ").\n");
  process.exit(1);
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code || 0),
  (err) => {
    process.stderr.write("gittomd: " + (err && err.stack ? err.stack : err) + "\n");
    process.exit(1);
  },
);
