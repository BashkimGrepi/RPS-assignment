/**
 * Matches Service - Database-First Architecture
 *
 * All queries now use PostgreSQL database instead of in-memory cache.
 * Data is synced by the background sync subsystem.
 */

import { prisma } from "../lib/prisma.js";
import { NormalizedGame } from "../types/rps-dto.js";
import { MatchResultType } from "../../generated/prisma/enums.js";

/**
 * Convert database Match to NormalizedGame format for API responses
 */
function matchToNormalizedGame(match: any): NormalizedGame {
  return {
    gameId: match.gameId,
    time: match.playedAt.getTime(),
    date: match.playedDate.toISOString().split("T")[0],
    playerA: {
      name: match.playerA.name,
      played: match.playerAChoice,
    },
    playerB: {
      name: match.playerB.name,
      played: match.playerBChoice,
    },
    winner: match.winnerPlayer?.name || null,
    isTie: match.resultType === MatchResultType.DRAW,
  };
}

/**
 * Get latest matches from database
 * @param limit - Maximum number of matches to return (default: 100)
 */
export const getLatestMatches = async (limit: number = 100): Promise<NormalizedGame[]> => {
  const matches = await prisma.match.findMany({
    take: limit,
    orderBy: { playedAt: "desc" },
    include: {
      playerA: true,
      playerB: true,
      winnerPlayer: true,
      loserPlayer: true,
    },
  });

  return matches.map(matchToNormalizedGame);
};

/**
 * Get the single most recent match
 */
export const getLatestHistoryMatch = async (): Promise<NormalizedGame | null> => {
    const match = await prisma.match.findFirst({
      orderBy: { playedAt: "desc" },
      include: {
        playerA: true,
        playerB: true,
        winnerPlayer: true,
        loserPlayer: true,
      },
    });

    return match ? matchToNormalizedGame(match) : null;
  };

/**
 * Get matches for a specific day (UTC)
 * @param date - Date string in YYYY-MM-DD format
 */
export const getMatchesByDay = async (date: string): Promise<NormalizedGame[]> => {
  const targetDate = new Date(date + "T00:00:00.000Z");

  const matches = await prisma.match.findMany({
    where: {
      playedDate: targetDate,
    },
    orderBy: { playedAt: "desc" },
    include: {
      playerA: true,
      playerB: true,
      winnerPlayer: true,
      loserPlayer: true,
    },
  });

  return matches.map(matchToNormalizedGame);
};

/**
 * Get all matches for a specific player
 * @param playerName - Player name (case-insensitive)
 */
export const getMatchesByPlayer = async (playerName: string): Promise<NormalizedGame[]> => {
  // Find player first
  const player = await prisma.player.findUnique({
    where: { name: playerName },
  });

  if (!player) {
    return [];
  }

  // Get all matches where player is either playerA or playerB
  const matches = await prisma.match.findMany({
    where: {
      OR: [{ playerAId: player.id }, { playerBId: player.id }],
    },
    orderBy: { playedAt: "desc" },
    include: {
      playerA: true,
      playerB: true,
      winnerPlayer: true,
      loserPlayer: true,
    },
  });

  return matches.map(matchToNormalizedGame);
};


export const getMatchesByDateAndPlayer = async (
  date: string,
  playerName: string,
): Promise<NormalizedGame[]> => {
  const targetDate = new Date(date + "T00:00:00.000Z");

  const player = await prisma.player.findUnique({
    where: { name: playerName },
  });

  if (!player) return [];

  const matches = await prisma.match.findMany({
    where: {
      playedDate: targetDate,
      OR: [{ playerAId: player.id }, { playerBId: player.id }],
    },
    orderBy: { playedAt: "desc" },
    include: {
      playerA: true,
      playerB: true,
      winnerPlayer: true,
      loserPlayer: true,
    },
  });

  return matches.map(matchToNormalizedGame);
};


/**
 * Get player statistics
 * @param playerName - Player name
 */
export const getPlayerStats = async (
  playerName: string,
): Promise<{
  totalMatches: number;
  wins: number;
  losses: number;
  ties: number;
}> => {
  // Find player first
  const player = await prisma.player.findUnique({
    where: { name: playerName },
  });

  if (!player) {
    return {
      totalMatches: 0,
      wins: 0,
      losses: 0,
      ties: 0,
    };
  }

  // Get aggregated stats from database
  const [totalMatches, wins, losses, ties] = await Promise.all([
    // Total matches
    prisma.match.count({
      where: {
        OR: [{ playerAId: player.id }, { playerBId: player.id }],
      },
    }),
    // Wins
    prisma.match.count({
      where: { winnerPlayerId: player.id },
    }),
    // Losses
    prisma.match.count({
      where: { loserPlayerId: player.id },
    }),
    // Ties
    prisma.match.count({
      where: {
        OR: [{ playerAId: player.id }, { playerBId: player.id }],
        resultType: MatchResultType.DRAW,
      },
    }),
  ]);

  return {
    totalMatches,
    wins,
    losses,
    ties,
  };
};

//gets all players with their total matches count

export const getAllPlayers = async (): Promise<Array< {name: string,  totalMatches: number, createdAt: Date }>> => {
  const players = await prisma.player.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          matchesAsA: true,
          matchesAsB: true,
        },
      },
    },
  });

  return players.map((player) => ({
    name: player.name,
    totalMatches: player._count.matchesAsA + player._count.matchesAsB,
    createdAt: player.createdAt,
  }));
};
