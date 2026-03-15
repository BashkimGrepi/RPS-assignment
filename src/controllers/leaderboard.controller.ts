import { Request, Response } from "express";
import {
  getTodayLeaderboard,
  getLeaderboardByDateRange,
} from "../services/leaderboard.service.js";

/**
 * GET /api/leaderboard/today?sortBy=wins|winRate
 * Returns today's leaderboard aggregated from cached history
 */
export async function getTodayLeaderboardController(
  req: Request,
  res: Response,
) { 
  try {
    const { sortBy } = req.query;

    const validateSortOptions = ["wins", "winRate"];
    const sortByStr = typeof sortBy === "string" ? sortBy : "wins"; // Default to "wins"

    if (!validateSortOptions.includes(sortByStr)) {
      return res.status(400).json({
        error: `Invalid sortBy parameter. Valid options are: ${validateSortOptions.join(", ",)}`,
      });
    }

    const leaderboard = await getTodayLeaderboard(sortByStr as "wins" | "winRate");
    res.json({ data: leaderboard, count: leaderboard.length });
  } catch (error) {
    console.error("Error fetching today leaderboard:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/leaderboard/history?from=YYYY-MM-DD&to=YYYY-MM-DD&sortBy=wins|winRate (legacy route)
 * Returns historical leaderboard for a date range
 */
export async function getHistoricalLeaderboard(req: Request, res: Response) {
  try {
    const { from, to, sortBy } = req.query;

    // Validate both parameters exist
    if (!from || typeof from !== "string") {
      return res
        .status(400)
        .json({ error: 'Missing or invalid "from" parameter' });
    }

    if (!to || typeof to !== "string") {
      return res
        .status(400)
        .json({ error: 'Missing or invalid "to" parameter' });
    }

    // Validate date format (YYYY-MM-DD)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(from)) {
      return res
        .status(400)
        .json({ error: 'Invalid "from" date format. Use YYYY-MM-DD' });
    }

    if (!datePattern.test(to)) {
      return res
        .status(400)
        .json({ error: 'Invalid "to" date format. Use YYYY-MM-DD' });
    }

    // Validate chronological order (string comparison works for YYYY-MM-DD)
    if (from > to) {
      return res
        .status(400)
        .json({ error: 'Invalid date range: "from" must be <= "to"' });
    }

    // Validate sortBy parameter
    const validSortOptions = ["wins", "winRate"];
    const sortByStr = typeof sortBy === "string" ? sortBy : "wins";

    if (!validSortOptions.includes(sortByStr)) {
      return res.status(400).json({
        error: `Invalid sortBy. Must be: ${validSortOptions.join(", ")}`,
      });
    }

    const leaderboard = await getLeaderboardByDateRange(from, to, sortByStr as "wins" | "winRate");
    res.json({ data: leaderboard, count: leaderboard.length });
  } catch (error) {
    console.error("Error fetching historical leaderboard:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

