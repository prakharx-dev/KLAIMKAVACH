import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import paymentRouter from "./routes/payment-routes.js";
import coreRouter from "./routes/core-routes.js";

const app = express();

// Simplify to allow all origins and credentials
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
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
