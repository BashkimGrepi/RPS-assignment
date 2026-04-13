// Leaderboard Service - Database-First Architecture
import { LeaderboardRow } from "../types/leaderboard.js";
import { prisma } from "../lib/prisma.js";
import { MatchResultType } from "../../generated/prisma/enums.js";
import { isValidUtcDateString } from "../utils/Zvalidation.js";
import { getPlayerLossesInDateRange, getPlayerTiesInDateRange, getPlayerTotalMatchesInDateRange, getPlayerWinsInDateRange, mergeGroupedCounts } from "../utils/leaderboardHerlpers.js";


const getTodayDateString = (): string => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};


// this function is not used anywhere yet.
// this is a more efficient implementation of the leaderboard querys.
// needs to be tested and compared with the old implementations before we switch to it 
// this function will replace the old buildLeaderboardFromDatabase function 
async function leaderboardDateRange(startDate: Date, endDate: Date, sortBy: "wins" | "winRate" = "wins"): Promise<LeaderboardRow[]> {
  
  try {
    if (!isValidUtcDateString(startDate.toISOString()))
      throw new Error("Invalid start date format. Dates must be in YYYY-MM-DD format.");
    if (!isValidUtcDateString(endDate.toISOString()))
      throw new Error("Invalid end date format. Dates must be in YYYY-MM-DD format.");
  
    if (startDate > endDate) {
      throw new Error("'from' date must be less than or equal to 'to' date");
    }
    const [wins, losses, ties, totalMatches] = await Promise.all([
     getPlayerWinsInDateRange(startDate, endDate),
     getPlayerLossesInDateRange(startDate, endDate),
     getPlayerTiesInDateRange(startDate, endDate),
     getPlayerTotalMatchesInDateRange(startDate, endDate)
    ]);
    
    const winsMap = mergeGroupedCounts(wins);
    const lossesMap = mergeGroupedCounts(losses);
    const tiesMap = mergeGroupedCounts(ties);
    const totalMatchesMap = mergeGroupedCounts(totalMatches);

    const allPlayerIds = new Set<number>([
      ...winsMap.keys(),
      ...lossesMap.keys(),
      ...tiesMap.keys(),
      ...totalMatchesMap.keys(),
    ])

    const players = await prisma.player.findMany({
      where: {
        id: {
          in: [...allPlayerIds],
        }
      },
      select: {
        id: true,
        name: true,
      },
    });

    const playerNameMap = new Map(players.map((p) => [p.id, p.name]));

    const leaderboard: LeaderboardRow[] = [...allPlayerIds].map((playerId) => {
      const wins = winsMap.get(playerId) ?? 0;
      const losses = lossesMap.get(playerId) ?? 0;
      const ties = tiesMap.get(playerId) ?? 0;
      const totalMatches = totalMatchesMap.get(playerId) ?? 0;

      const winRate = totalMatches > 0 ? Number((wins / totalMatches).toFixed(2)) : 0;
      return {
        playerName: playerNameMap.get(playerId) ?? "Unknown Player",
        wins,
        losses,
        ties,
        totalMatches,
        winRate,
      };
    });
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
  } catch (error) {
    console.error("Error building leaderboard:", error);
    throw error;
  }
}



// old one 
// still in use
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
  if (!["wins", "winRate"].includes(sortBy)) {
    throw new Error("Invalid sortBy value. Must be either 'wins' or 'winRate'");
  }


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


// this old function is still called in controller 

export const getTodayLeaderboard = async (sortBy: "wins" | "winRate" = "wins"): Promise<LeaderboardRow[]> => {
  const today = getTodayDateString();
  const todayDate = new Date(today + "T00:00:00.000Z");

  return buildLeaderboardFromDatabase(todayDate, todayDate, sortBy);
};

// this function is called in controller
export const getLeaderboardByDateRange = async (from: string, to: string, sortBy: "wins" | "winRate" = "wins"): Promise<LeaderboardRow[]> => {
  const startDate = new Date(from + "T00:00:00.000Z");
  const endDate = new Date(to + "T00:00:00.000Z");


  if (startDate > endDate) {
    throw new Error("'from' date must be less than or equal to 'to' date");
  }

  // range cap of 1 year to prevent excessive load
  const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
  if (endDate.getTime() - startDate.getTime() > oneYearInMs) {
    throw new Error("Date range cannot exceed 1 year");
  }

  return buildLeaderboardFromDatabase(startDate, endDate, sortBy);
};
