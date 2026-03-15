import { Router } from "express";
import {
  getTodayLeaderboardController,
  getHistoricalLeaderboard,
} from "../controllers/leaderboard.controller.js";

const router = Router();

router.get("/today", getTodayLeaderboardController);
router.get("/history", getHistoricalLeaderboard); // Legacy route


export default router;
