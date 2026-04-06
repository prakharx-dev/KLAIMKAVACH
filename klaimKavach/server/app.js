import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import paymentRouter from "./routes/payment-routes.js";
import coreRouter from "./routes/core-routes.js";

const app = express();

const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const defaultOrigins = [
  "http://localhost:5001",
  "http://localhost:5173",
  "http://127.0.0.1:5001",
  "http://127.0.0.1:5173",
];

const corsAllowlist = new Set([...defaultOrigins, ...allowedOrigins]);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow all origins if FRONTEND_ORIGIN is '*' or not set in production
      if (!origin || corsAllowlist.has("*") || allowedOrigins.length === 0) {
        return callback(null, true);
      }
      
      const isLocalDevOrigin =
        typeof origin === "string" &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

      if (corsAllowlist.has(origin) || isLocalDevOrigin) {
        return callback(null, true);
      }
      
      // Return a JSON error instead of throwing an exception (which causes HTML response)
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  }),
);

app.use(bodyParser.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use("/api/payment", paymentRouter);
app.use("/api", paymentRouter);
app.use("/api", coreRouter);

// Global Error Handler to ensure JSON responses on errors (like CORS block or others)
app.use((err, req, res, next) => {
  // If headers are already sent, delegate to Express default handler
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined
  });
});

// JSON 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API Route not found: ${req.url}`
  });
});

export default app;
