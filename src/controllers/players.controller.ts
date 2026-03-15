import { Request, Response } from "express";
import {
  getMatchesByPlayer,
  getPlayerStats,
  getAllPlayers,
} from "../services/matches.service.js";

/**
 * GET /api/players
 * Returns all players in the database
 */
export async function getAllPlayersController(req: Request, res: Response) {
  try {
    const players = await getAllPlayers();
    res.json({ data: players, count: players.length });
  } catch (error) {
    console.error("Error fetching players:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}




/**
 * GET /api/players/:name/stats
 * Returns only stats for a specific player
 */
export async function getPlayerStatsController(req: Request, res: Response) {
  try {
    const { name } = req.params;

    // Validate player name
    if (!name || typeof name !== "string" || !name.trim()) {
      return res
        .status(400)
        .json({ error: "Missing or invalid player name parameter" });
    }

    const stats = await getPlayerStats(name);

    res.json({
      player: name,
      ...stats,
    });
  } catch (error) {
    console.error("Error fetching player stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
