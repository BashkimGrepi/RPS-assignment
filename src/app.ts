import express from "express";
import cors from "cors";
import matchesRouter from "./routes/matches.routes.js";
import leaderboardRouter from "./routes/leaderboard.routes.js";
import { getHealthStatus } from "./controllers/health.controller.js";
import liveRouter from "./routes/live.routes.js";
import { env } from "./config/env.js";

const app = express();

app.use(
  cors({
    origin: env.ORIGIN,
    credentials: true,
  }),
);

app.use(express.json());

app.get("/", (_req, res) => {
  res.send("RPS backend is running");
});

// Health check endpoint
app.get("/health", getHealthStatus);

// API routes
app.use("/api/matches", matchesRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/live", liveRouter);

export default app;
