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

const mockApiPlugin = (): Plugin => {
  let activeUserName = "Gig Worker"; // In-memory state

  return {
    name: 'mock-api',
    configureServer(server) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url?.startsWith('/api/')) {
          res.setHeader('Content-Type', 'application/json');

          if (req.url.includes('/register') && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                if (data.name) {
                  activeUserName = data.name;
                }
              } catch (e) {
                // Ignore parse errors
              }
              res.end(JSON.stringify({ success: true, userId: "u_123", message: "Registered successfully" }));
            });
            return;
          }

          if (req.url.includes('/dashboard')) {
            res.end(JSON.stringify({
              userName: activeUserName,
              riskScore: 24,
              riskLevel: "Low Risk",
              weeklyPremium: 149,
              coverageAmount: 25000,
              activePolicies: 1,
              totalClaims: 0,
              lastUpdated: new Date().toISOString()
            }));
            return;
          }

          if (req.url.includes('/disruption')) {
            res.end(JSON.stringify({
              hasDisruption: false,
              type: "None",
              severity: "None",
              message: "Clear skies and normal traffic in your zone.",
              eligibleForClaim: false
            }));
            return;
          }

          if (req.url.includes('/claim')) {
            res.end(JSON.stringify({
              success: true,
              claimId: "cl_789",
              payoutAmount: 500,
              status: "Approved",
              message: "Claim approved instantly by AI."
            }));
            return;
          }

          if (req.url.includes('/fraud')) {
            res.end(JSON.stringify({
              trustScore: 98,
              status: "Excellent",
              label: "Verified",
              details: "No anomalous patterns detected in recent activity."
            }));
            return;
          }

          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Not found" }));
          return;
        }
        next();
      });
    }
  };
};

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    mockApiPlugin(),
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
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
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
