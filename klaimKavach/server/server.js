import dotenv from "dotenv";
import path from "path";

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(import.meta.dirname, "../.env"),
  path.resolve(import.meta.dirname, "../../.env"),
  path.resolve(import.meta.dirname, "../.env.local"),
  path.resolve(import.meta.dirname, "../../.env.local"),
];

for (const envPath of envCandidates) {
  dotenv.config({ path: envPath, override: false });
}

const { connectToDatabase } = await import("./config/mongodb.js");
const { default: app } = await import("./app.js");

const port = Number(process.env.BACKEND_PORT ?? 5000);

try {
  await connectToDatabase();

  app.listen(port, () => {
    console.log(`Backend running on http://localhost:${port}`);
  });
} catch (error) {
  console.error("Failed to start backend:", error);
  process.exit(1);
}
