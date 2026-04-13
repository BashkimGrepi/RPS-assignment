import { Request, Response } from "express";
import {
  getTodayLeaderboard,
  getLeaderboardByDateRange,
} from "../services/leaderboard.service.js";
import { sortBySchema, historyLeaderboardQuerySchema } from "../utils/Zvalidation.js";




  //GET /api/leaderboard/today?sortBy=wins|winRate
  //Returns today's leaderboard aggregated from cached history
 
export async function getTodayLeaderboardController(
  req: Request,
  res: Response,
) { 
  try {
    // validation with zod schema for query parameters
    const validSortOptions = sortBySchema.safeParse(req.query);
    if (!validSortOptions.success) {
      return res.status(400).json({
        error: {
          code: "INVALID_QUERY",
          message: "Invalid query parameters",
          details: validSortOptions.error.flatten()
        }
      });
    }

    const leaderboard = await getTodayLeaderboard(validSortOptions.data.sortBy);
    res.json({ data: leaderboard, count: leaderboard.length });
  } catch (error) {
    console.error("Error fetching today leaderboard:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      }
     });
  }
}

/**
 * GET /api/leaderboard/history?from=YYYY-MM-DD&to=YYYY-MM-DD&sortBy=wins|winRate (legacy route)
 * Returns historical leaderboard for a date range
 */
export async function getHistoricalLeaderboard(req: Request, res: Response) {
  try {
    const validQueries = historyLeaderboardQuerySchema.safeParse(req.query);
    if (!validQueries.success) {
      return res.status(400).json({
        error: {
          code: "INVALID_QUERY",
          message: "Invalid query parameters",
          details: validQueries.error.flatten()
        }
      });
    }

    const { from, to, sortBy } = validQueries.data;

    const leaderboard = await getLeaderboardByDateRange(from, to, sortBy);
    res.json({ data: leaderboard, count: leaderboard.length });
  } catch (error) {
    console.error("Error fetching historical leaderboard:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      }
    });
  }
}

