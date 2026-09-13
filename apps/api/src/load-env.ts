import { config } from "dotenv";
import { fileURLToPath } from "node:url";

// 根目录 .env（apps/api/src → 上三级）
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
