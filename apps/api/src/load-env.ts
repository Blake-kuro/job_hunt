import { config } from "dotenv";
import { fileURLToPath } from "node:url";

// 根目录 .env（src → 根）
config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });
