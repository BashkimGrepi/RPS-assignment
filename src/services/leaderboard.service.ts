/**
 * Leaderboard Service - Database-First Architecture
 *
 * Uses SQL aggregation for efficient leaderboard calculations.
 * All data comes from PostgreSQL database.
 */

import { LeaderboardRow } from "../types/leaderboard.js";
import { prisma } from "../lib/prisma.js";
import { MatchResultType } from "../../generated/prisma/enums.js";

/**
 * Get today's date in YYYY-MM-DD format (UTC)
 */
const getTodayDateString = (): string => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/**
 * Build leaderboard from database for a specific date range
 * Uses SQL aggregation for efficiency
 */
async function buildLeaderboardFromDatabase(
  startDate: Date,
  endDate: Date,
  sortBy: "wins" | "winRate" = "wins",
): Promise<LeaderboardRow[]> {
  // Get all players who played in this date range
  const playersInRange = await prisma.player.findMany({
    where: {
      OR: [
        {
          matchesAsA: {
            some: {
              playedDate: {
                gte: startDate,
                lte: endDate,
              },
            },
          },
        },
        {
          matchesAsB: {
            some: {
              playedDate: {
                gte: startDate,
                lte: endDate,
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
    },
  });

  // For each player, get their stats
  const leaderboard: LeaderboardRow[] = await Promise.all(
    playersInRange.map(async (player) => {
      const [totalMatches, wins, losses, ties] = await Promise.all([

        // Total matches in date range
        prisma.match.count({
          where: {
            OR: [{ playerAId: player.id }, { playerBId: player.id }],
            playedDate: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
        // Wins in date range
        prisma.match.count({
          where: {
            winnerPlayerId: player.id,
            playedDate: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
        // Losses in date range
        prisma.match.count({
          where: {
            loserPlayerId: player.id,
            playedDate: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
        // Ties in date range
        prisma.match.count({
          where: {
            OR: [{ playerAId: player.id }, { playerBId: player.id }],
            resultType: MatchResultType.DRAW,
            playedDate: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
      ]);

      const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) / 100 : 0;

      return {
        playerName: player.name,
        wins,
        losses,
        ties,
        totalMatches,
        winRate,
      };
    }),
  );

  // Sort by the specified criteria

 return leaderboard.sort((a, b) => {
   if (sortBy === "winRate") {
     if (b.winRate !== a.winRate) {
       return b.winRate - a.winRate;
     }
     if (b.wins !== a.wins) {
       return b.wins - a.wins;
     }
   } else {
     if (b.wins !== a.wins) {
       return b.wins - a.wins;
     }
   }
   // Final tiebreaker: alphabetical
   return a.playerName.localeCompare(b.playerName);

 });
}

/**
 * Get today's leaderboard
 */
export const getTodayLeaderboard = async (sortBy: "wins" | "winRate" = "wins"): Promise<LeaderboardRow[]> => {
  const today = getTodayDateString();
  const todayDate = new Date(today + "T00:00:00.000Z");

  return buildLeaderboardFromDatabase(todayDate, todayDate, sortBy);
};

/**
 * Get leaderboard for a date range
 * @param from - Start date in YYYY-MM-DD format
 * @param to - End date in YYYY-MM-DD format
 */
export const getLeaderboardByDateRange = async (
  from: string,
  to: string,
  sortBy: "wins" | "winRate" = "wins",
): Promise<LeaderboardRow[]> => {
  const startDate = new Date(from + "T00:00:00.000Z");
  const endDate = new Date(to + "T00:00:00.000Z");

  return buildLeaderboardFromDatabase(startDate, endDate, sortBy);
};
