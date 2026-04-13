import { Request, Response } from "express";
import {
  getLatestMatches,
  getMatchesByPlayer,
  getPlayerStats,
  getMatchesByDay,
  getMatchesByDateAndPlayer,
} from "../services/matches.service.js";
import { getMatchesSchema } from "../utils/Zvalidation.js";



// GET /api/matches
// Optional query params:
// - date=YYYY-MM-DD (UTC day)
// - playerName=string (case-insensitive match)
// If no query params, return latest matches (up to 100)
export async function getMatchesController(req: Request, res: Response) {
  try {
    const validatedQuery = getMatchesSchema.safeParse(req.query);
    if (!validatedQuery.success) {
      return res.status(400).json({
        error: {
          code: "INVALID_QUERY",
          message: "Invalid query parameters",
          details: validatedQuery.error.flatten()
        }
      });
    }
    const valDate = validatedQuery.data.date
    const valPlayerName = validatedQuery.data.playerName;

    // Both filters
    if (valDate && valPlayerName) {
      const matches = await getMatchesByDateAndPlayer(valDate, valPlayerName);
      const stats = await getPlayerStats(valPlayerName);

      return res.json({
        data: matches,
        count: matches.length,
        playerStats: {
          player: valPlayerName,
          ...stats,
        },
      });
    }

    // Date only
    if (valDate) {
      const matches = await getMatchesByDay(valDate);
      return res.json({ data: matches, count: matches.length });
    }

    // Player only
    if (valPlayerName) {
      const matches = await getMatchesByPlayer(valPlayerName);
      const stats = await getPlayerStats(valPlayerName);
      return res.json({
        data: matches,
        count: matches.length,
        playerStats: {
          player: valPlayerName,
          ...stats,
        },
      });
    }

    // Neither - return latest matches
    const matches = await getLatestMatches(100);
    res.json({ data: matches, count: matches.length });
  } catch (error) {
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      }
    });
  }
}
