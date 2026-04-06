import dotenv from "dotenv";
import path from "path";

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "klaimKavach/.env"),
  path.resolve(import.meta.dirname, "../.env"),
];

for (const envPath of envCandidates) {
  dotenv.config({ path: envPath, override: false });
}
