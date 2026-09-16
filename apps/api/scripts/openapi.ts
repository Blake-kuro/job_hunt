import { readFileSync, writeFileSync } from "node:fs";
import app, { OPENAPI_INFO } from "../src/app";

const doc = app.getOpenAPI31Document(OPENAPI_INFO);
const output = `${JSON.stringify(doc, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (readFileSync("openapi.json", "utf8") !== output) {
    console.error("OpenAPI 已过期，请在仓库根目录运行 pnpm gen:api");
    process.exit(1);
  }
} else {
  writeFileSync("openapi.json", output);
}
console.log(`openapi.json：${Object.keys(doc.paths ?? {}).length} 条路径`);
