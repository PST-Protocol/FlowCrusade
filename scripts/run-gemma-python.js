import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ override: true });

function readLocalConfig() {
  const configPath = path.join(process.cwd(), "config.json");
  try {
    if (!fs.existsSync(configPath)) return {};
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return {};
  }
}

const config = readLocalConfig();
const python = process.env.GEMMA_PYTHON || config.gemma?.python || "python";
const args = process.argv.slice(2);

if (!args.length) {
  console.error("Usage: node scripts/run-gemma-python.js <script.py> [args...]");
  process.exit(2);
}

const result = spawnSync(python, args, {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
