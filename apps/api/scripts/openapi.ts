import { writeFileSync } from "node:fs";
import app, { OPENAPI_INFO } from "../src/app";

const doc = app.getOpenAPI31Document(OPENAPI_INFO);
writeFileSync("openapi.json", `${JSON.stringify(doc, null, 2)}\n`);
console.log(`openapi.json：${Object.keys(doc.paths ?? {}).length} 条路径`);
