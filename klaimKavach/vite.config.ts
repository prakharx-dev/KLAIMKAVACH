import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT || "5001";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH || "/";
const useMockApi =
  process.env.MOCK_API !== undefined
    ? process.env.MOCK_API === "true"
    : process.env.NODE_ENV !== "production";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isPrivateIp(ipAddress?: string): boolean {
  if (!ipAddress) return true;
  if (ipAddress === "::1") return true;

  if (ipAddress.includes(".")) {
    const parts = ipAddress.split(".").map((part) => Number(part));
    if (
      parts.length !== 4 ||
      parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)
    ) {
      return true;
    }

    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    return false;
  }

  const lowered = ipAddress.toLowerCase();
  return lowered.startsWith("fc") || lowered.startsWith("fd");
}

function simpleHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function isLikelyInIndia(latitude: number, longitude: number): boolean {
  return latitude >= 6 && latitude <= 38 && longitude >= 68 && longitude <= 98;
}

function calculateMockTrustScore(input: {
  latitude?: number;
  longitude?: number;
  ipAddress?: string;
}): { trustScore: number; status: string; label: string; details: string } {
  let score = 50;
  const hasLocation =
    typeof input.latitude === "number" &&
    Number.isFinite(input.latitude) &&
    input.latitude >= -90 &&
    input.latitude <= 90 &&
    typeof input.longitude === "number" &&
    Number.isFinite(input.longitude) &&
    input.longitude >= -180 &&
    input.longitude <= 180;
  const hasPublicIp = !!input.ipAddress && !isPrivateIp(input.ipAddress);

  if (hasLocation) {
    const latitude = input.latitude as number;
    const longitude = input.longitude as number;

    score += isLikelyInIndia(latitude, longitude) ? 18 : -10;
    const locationFingerprint = `${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
    score += simpleHash(locationFingerprint) % 12;
  } else {
    score -= 12;
  }

  if (hasPublicIp) {
    score += 10 + (simpleHash(input.ipAddress as string) % 10);
  } else {
    score -= 14;
  }

  const trustScore = clamp(Math.round(score), 0, 100);

  if (trustScore > 75) {
    return {
      trustScore,
      status: "Excellent",
      label: "Verified",
      details:
        "Location and network signals look trustworthy. Claims are eligible for fast-track verification.",
    };
  }

  if (trustScore >= 45) {
    return {
      trustScore,
      status: "Moderate",
      label: "Needs Review",
      details:
        "Some trust signals are weak or incomplete. Additional checks may be required for high-value claims.",
    };
  }

  return {
    trustScore,
    status: "High Risk",
    label: "Suspicious",
    details:
      "Trust signals are low due to inconsistent location or IP data. Manual fraud screening is recommended.",
  };
}

function getRealtimeDashboardPayload(userName: string) {
  const now = Date.now();
  const cycle = Math.sin(now / 20000);
  const riskScore = Math.round(38 + cycle * 18);

  let riskLevel = "Low Risk";
  if (riskScore > 70) {
    riskLevel = "High Risk";
  } else if (riskScore >= 30) {
    riskLevel = "Medium Risk";
  }

  const totalClaims = 1 + Math.floor((now / 45000) % 5);

  return {
    userName,
    riskScore,
    riskLevel,
    weeklyPremium: 49,
    coverageAmount: 25000,
    activePolicies: 1,
    totalClaims,
    lastUpdated: new Date().toISOString(),
  };
}

const mockApiPlugin = (): Plugin => {
  let activeUserName = "Gig Worker";
  const usersByEmail = new Map<
    string,
    { name: string; role: "admin" | "gigworker"; planId: null }
  >();

  return {
    name: "mock-api",
    configureServer(server) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url?.startsWith("/api/")) {
          res.setHeader("Content-Type", "application/json");

          if (req.url.includes("/register") && req.method === "POST") {
            let body = "";
            req.on("data", (chunk: Buffer) => {
              body += chunk.toString();
            });
            req.on("end", () => {
              let role: "admin" | "gigworker" = "gigworker";
              try {
                const data = JSON.parse(body);
                const email =
                  typeof data.email === "string"
                    ? data.email.trim().toLowerCase()
                    : "";
                if (data.name) {
                  activeUserName = data.name;
                }
                role = data.role === "admin" ? "admin" : "gigworker";

                if (email) {
                  usersByEmail.set(email, {
                    name: data.name || "Gig Worker",
                    role,
                    planId: null,
                  });
                }
              } catch (e) {
                // Ignore parse errors
              }
              res.end(
                JSON.stringify({
                  success: true,
                  userId: "u_123",
                  message: "Registered successfully",
                  userName: activeUserName,
                  role,
                  planId: null,
                }),
              );
            });
            return;
          }

          if (req.url.includes("/signin") && req.method === "POST") {
            let body = "";
            req.on("data", (chunk: Buffer) => {
              body += chunk.toString();
            });
            req.on("end", () => {
              try {
                const data = JSON.parse(body);
                const email =
                  typeof data.email === "string"
                    ? data.email.trim().toLowerCase()
                    : "";
                const user = email ? usersByEmail.get(email) : undefined;

                if (!user) {
                  res.statusCode = 404;
                  res.end(
                    JSON.stringify({
                      success: false,
                      message: "User not found.",
                    }),
                  );
                  return;
                }

                activeUserName = user.name;
                res.end(
                  JSON.stringify({
                    success: true,
                    message: "Signed in successfully",
                    userName: user.name,
                    role: user.role,
                    planId: user.planId,
                  }),
                );
              } catch {
                res.statusCode = 400;
                res.end(
                  JSON.stringify({
                    success: false,
                    message: "Invalid payload.",
                  }),
                );
              }
            });
            return;
          }

          if (req.url.includes("/dashboard")) {
            res.end(
              JSON.stringify(getRealtimeDashboardPayload(activeUserName)),
            );
            return;
          }

          if (req.url.includes("/disruption")) {
            res.end(
              JSON.stringify({
                hasDisruption: false,
                type: "None",
                severity: "None",
                message: "Clear skies and normal traffic in your zone.",
                eligibleForClaim: false,
              }),
            );
            return;
          }

          if (req.url.includes("/claim")) {
            res.end(
              JSON.stringify({
                success: true,
                claimId: "cl_789",
                payoutAmount: 500,
                status: "Approved",
                message: "Claim approved instantly by AI.",
              }),
            );
            return;
          }

          if (req.url.includes("/fraud")) {
            if (req.method === "POST") {
              let body = "";
              req.on("data", (chunk: Buffer) => {
                body += chunk.toString();
              });
              req.on("end", () => {
                let parsed: {
                  latitude?: number;
                  longitude?: number;
                  ipAddress?: string;
                } = {};
                try {
                  parsed = JSON.parse(body);
                } catch {
                  parsed = {};
                }
                res.end(JSON.stringify(calculateMockTrustScore(parsed)));
              });
              return;
            }

            res.end(JSON.stringify(calculateMockTrustScore({})));
            return;
          }

          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Not found" }));
          return;
        }
        next();
      });
    },
  };
};

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(useMockApi ? [mockApiPlugin()] : []),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "attached_assets",
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
