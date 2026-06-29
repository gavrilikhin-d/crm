import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const here = fileURLToPath(new URL(".", import.meta.url));
const rootEnv = resolve(here, "../../.env");
const localEnv = resolve(here, "../.env");

if (existsSync(rootEnv)) {
  config({ path: rootEnv });
} else if (existsSync(localEnv)) {
  config({ path: localEnv });
}
