import dotenv from "dotenv";
import path from "path";

const envCandidates = [
  path.resolve(import.meta.dirname, "../.env"),
  path.resolve(import.meta.dirname, "../../.env"),
  path.resolve(import.meta.dirname, "../.env.local"),
  path.resolve(import.meta.dirname, "../../.env.local"),
];

for (const envPath of envCandidates) {
  dotenv.config({ path: envPath, override: false });
}

const { default: app } = await import("./app.js");

const port = Number(process.env.BACKEND_PORT ?? 5000);

app.listen(port, () => {
  console.log(`Razorpay backend running on http://localhost:${port}`);
});
