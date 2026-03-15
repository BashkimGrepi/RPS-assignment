import { Request, Response } from "express";
import {
  getLatestHistoryMatch,
  getLatestMatches,
  getMatchesByPlayer,
  getPlayerStats,
  getMatchesByDay,
  getMatchesByDateAndPlayer,
} from "../services/matches.service.js";


// GET /api/matches
// Optional query params:
// - date=YYYY-MM-DD (UTC day)
// - playerName=string (case-insensitive match)
// If no query params, return latest matches (up to 100)
export async function getMatchesController(req: Request, res: Response) {
  try {
    const { date, playerName } = req.query;
    
    const dateStr = typeof date === "string" ? date : undefined;
    const playerNameStr = typeof playerName === "string" ? playerName : undefined;

    // Both filters
    if (dateStr && playerNameStr) {
      const matches = await getMatchesByDateAndPlayer(dateStr, playerNameStr);
          const stats = await getPlayerStats(playerNameStr);

      return res.json({
        data: matches,
        count: matches.length,
        playerStats: {
          player: playerName,
          ...stats,
        },
      });
    }

    // Date only
    if (dateStr) {
      const matches = await getMatchesByDay(dateStr);
      return res.json({ data: matches, count: matches.length });
    }

    // Player only
    if (playerNameStr) {
      const matches = await getMatchesByPlayer(playerNameStr);
      const stats = await getPlayerStats(playerNameStr);
      return res.json({
        data: matches,
        count: matches.length,
        playerStats: {
          player: playerNameStr,
          ...stats,
        },
      });
    }

    // Neither - return latest matches
    const matches = await getLatestMatches(100);
    res.json({ data: matches, count: matches.length });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}


// this function will get called in the GetMatchesController if the query params are missing
 async function getLatestMatch(req: Request, res: Response) {
  try {
    const { limit } = req.query;

    // Parse and validate limit parameter
    let limitNum = 100; // default
    if (limit) {
      if (typeof limit !== "string") {
        return res.status(400).json({ error: "Invalid limit parameter" });
      }

      limitNum = parseInt(limit, 10);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
        return res.status(400).json({
          error: "Limit must be a number between 1 and 1000",
        });
      }
    }

    const matches = await getLatestMatches(limitNum);
    res.json({ data: matches, count: matches.length });
  } catch (error) {
    console.error("Error fetching latest matches:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// this function will get called in the getMatchesController if the playerName query param is provided
 async function getMatchesByPlayerController(
  req: Request,
  res: Response,
) {
  try {
    const { playerName } = req.params;

    // Validate playerName exists and is not empty
    if (!playerName || typeof playerName !== "string" || !playerName.trim()) {
      return res
        .status(400)
        .json({ error: "Missing or invalid playerName parameter" });
    }

    const matches = await getMatchesByPlayer(playerName);
    const stats = await getPlayerStats(playerName);

    res.json({
      data: matches,
      count: matches.length,
      playerStats: {
        player: playerName,
        ...stats,
      },
    });
  } catch (error) {
    console.error("Error fetching matches by player:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// this function will get called in the getMatchesController if the date query param is provided
 async function getMatchesByDayController(req: Request, res: Response) {
  try {
    const { date } = req.query;

    // Validate date exists and is a string
    if (!date || typeof date !== "string") {
      return res
        .status(400)
        .json({ error: "Missing or invalid date parameter" });
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    const matches = await getMatchesByDay(date);
    res.json({ data: matches, count: matches.length });
  } catch (error) {
    console.error("Error fetching matches by day:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

