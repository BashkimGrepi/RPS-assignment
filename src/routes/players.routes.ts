import { Router } from "express";
import {
  getPlayerStatsController,
  getAllPlayersController,
} from "../controllers/players.controller.js";

const router = Router();

// Get all players
router.get("/", getAllPlayersController);

// Get specific player's stats only
router.get("/:name/stats", getPlayerStatsController);

export default router;
