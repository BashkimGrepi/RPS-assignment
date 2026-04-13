
import { MatchResultType } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";


const addCountToMap = (
    map: Map<number, number>,
    playerId: number,
    count: number,
) => {
    map.set(playerId, (map.get(playerId) ?? 0) + count);
};

export const mergeGroupedCounts = (rows: Array<{ playerId: number; count: number }>): Map<number, number> => {
  const results = new Map<number, number>();
  
  for (const row of rows) {
    results.set(row.playerId, row.count);
  }
  return results;
};

export const getPlayerWinsInDateRange = async (
  startDate: Date,
  endDate: Date,
) => {
  const wins = await prisma.match.groupBy({
    by: ["winnerPlayerId"],
    where: {
      playedDate: {
        gte: startDate,
        lt: endDate,
      },
    },
    _count: {
      winnerPlayerId: true,
    },
  });
  // player id is an integer. We need to convert it to player name later.
  return wins.map((row) => ({
    playerId: row.winnerPlayerId!,
    count: row._count.winnerPlayerId,
  }));
};

export const getPlayerLossesInDateRange = async (
  startDate: Date,
  endDate: Date,
) => {
  const losses = await prisma.match.groupBy({
    by: ["loserPlayerId"],
    where: {
      playedDate: {
        gte: startDate,
        lt: endDate,
      },
    },
    _count: {
      loserPlayerId: true,
    },
  });
  return losses.map((row) => ({
    playerId: row.loserPlayerId!,
    count: row._count.loserPlayerId,
  }));
};

export const getPlayerTiesInDateRange = async (
  startDate: Date,
  endDate: Date,
) => {
  const [tiesAsA, tiesAsB] = await Promise.all([
    prisma.match.groupBy({
      by: ["playerAId"],
      where: {
        playedDate: {
          gte: startDate,
          lt: endDate,
        },
        resultType: MatchResultType.DRAW,
      },
      _count: {
        playerAId: true,
      },
    }),

    prisma.match.groupBy({
      by: ["playerBId"],
      where: {
        playedDate: {
          gte: startDate,
          lt: endDate,
        },
        resultType: MatchResultType.DRAW,
      },
      _count: {
        playerBId: true,
      },
    }),
  ]);

  const tiesMap = new Map<number, number>();

  for (const row of tiesAsA) {
    addCountToMap(tiesMap, row.playerAId, row._count.playerAId);
  }

  for (const row of tiesAsB) {
    addCountToMap(tiesMap, row.playerBId, row._count.playerBId);
  }

  return [...tiesMap.entries()].map(([playerId, count]) => ({
    playerId,
    count,
  }));
};

export const getPlayerTotalMatchesInDateRange = async (
  startDate: Date,
  endDate: Date,
) => {
  const [matchesAsA, mathcesAsB] = await Promise.all([
    prisma.match.groupBy({
      by: ["playerAId"],
      where: {
        playedDate: {
          gte: startDate,
          lt: endDate,
        },
      },
      _count: {
        playerAId: true,
      },
    }),
    prisma.match.groupBy({
      by: ["playerBId"],
      where: {
        playedDate: {
          gte: startDate,
          lt: endDate,
        },
      },
      _count: {
        playerBId: true,
      },
    }),
  ]);

  const totalMatchesMap = new Map<number, number>();

  for (const row of matchesAsA) {
    addCountToMap(totalMatchesMap, row.playerAId, row._count.playerAId);
  }

  for (const row of mathcesAsB) {
    addCountToMap(totalMatchesMap, row.playerBId, row._count.playerBId);
  }
  return [...totalMatchesMap.entries()].map(([playerId, count]) => ({
    playerId,
    count,
  }));
};
