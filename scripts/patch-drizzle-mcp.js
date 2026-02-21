#!/usr/bin/env node
/**
 * Patches drizzle-mcp for Windows compatibility.
 *
 * On Windows, ESM dynamic import() fails with absolute paths like C:\...
 * because they get interpreted as protocol "c:". This patch converts
 * paths to file:// URLs before importing.
 *
 * See: https://github.com/defrex/drizzle-mcp/issues
 */
const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "..",
  "node_modules",
  "drizzle-mcp",
  "dist",
  "database.js"
);

if (!fs.existsSync(filePath)) {
  console.log("drizzle-mcp not installed, skipping patch");
  process.exit(0);
}

let content = fs.readFileSync(filePath, "utf8");

if (content.includes("pathToFileURL")) {
  console.log("drizzle-mcp already patched, skipping");
  process.exit(0);
}

// Add pathToFileURL import
content = content.replace(
  'import { resolve } from "node:path";',
  'import { resolve } from "node:path";\nimport { pathToFileURL } from "node:url";'
);

// Fix the import() call to use file:// URLs
content = content.replace(
  "return await import(modulePath);",
  "return await import(pathToFileURL(modulePath).href);"
);

fs.writeFileSync(filePath, content, "utf8");
console.log("Patched drizzle-mcp for Windows file:// URL compatibility");
