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
    origin(origin, callback) {
      const isLocalDevOrigin =
        typeof origin === "string" &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

      if (!origin || corsAllowlist.has(origin) || isLocalDevOrigin) {
        callback(null, true);
        return;
      }
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

export default app;
