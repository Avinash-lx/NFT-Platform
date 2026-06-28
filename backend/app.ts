import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config";
import { router } from "./routes";
import { errorHandler } from "./lib/http";
import { globalRateLimit } from "./middleware/rateLimit";

/** Build and configure the Express application. */
export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(config.env === "development" ? "dev" : "combined"));
  app.use(globalRateLimit);

  app.get("/health", (_req, res) => res.json({ ok: true, network: config.solana.network }));

  app.use("/api", router);

  app.use(errorHandler);
  return app;
}
