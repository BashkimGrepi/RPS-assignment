import { prisma } from "../lib/prisma.js";
import type { Player, Match } from "../../generated/prisma/client.js";
import { TransformedMatch } from "../types/rps-dto.js";


  // Find or create a player by name
  // Uses upsert to handle deduplication via unique name constraint
 
export const upsertPlayer = async (name: string): Promise<Player> => {
  return await prisma.player.upsert({
    where: { name },
    update: {}, // If player exists, don't update anything
    create: { name },
  });
};

// Upsert a single match with player handling
// Ensures players exist before creating the match

export const upsertMatch = async (transformedMatch: TransformedMatch): Promise<Match> => {
  const [playerA, playerB] = await Promise.all([
    upsertPlayer(transformedMatch.playerAName),
    upsertPlayer(transformedMatch.playerBName),
  ]);

  let winnerPlayerId: number | null = null;
  let loserPlayerId: number | null = null;

  if (transformedMatch.winnerPlayerName) {
    if (transformedMatch.winnerPlayerName === transformedMatch.playerAName) {
      winnerPlayerId = playerA.id;
      loserPlayerId = playerB.id;
    } else {
      winnerPlayerId = playerB.id;
      loserPlayerId = playerA.id;
    }
  }



  return await prisma.match.upsert({
    where: { gameId: transformedMatch.gameId },
    update: {
      // If match already exists, only update the source
      // This allows tracking if a match came from multiple sources
      ingestedFrom: transformedMatch.ingestedFrom,
    },
    create: {
      gameId: transformedMatch.gameId,
      playedAt: transformedMatch.playedAt,
      playedDate: transformedMatch.playedDate,
      playerAId: playerA.id,
      playerBId: playerB.id,
      playerAChoice: transformedMatch.playerAChoice,
      playerBChoice: transformedMatch.playerBChoice,
      resultType: transformedMatch.resultType,
      winnerPlayerId,
      loserPlayerId,
      ingestedFrom: transformedMatch.ingestedFrom,
    },
  });
};


//  Batch upsert multiple matches efficiently
//  Processes matches sequentially to avoid conflicts
 
export const upsertMatches = async (
  transformedMatches: TransformedMatch[],
): Promise<[Match[], insertedCount: number, duplicateCount: number]> => {
  const results: Match[] = [];
  let insertedCount = 0;
  let duplicateCount = 0;

  // Process sequentially to avoid race conditions with player creation
  for (const transformedMatch of transformedMatches) {
    const match = await upsertMatch(transformedMatch);
    if (match.createdAt.getTime() === match.updatedAt.getTime()) {
      insertedCount++;
    } else {
      duplicateCount++;
    }

    results.push(match);
  }

  return [results, insertedCount, duplicateCount];
};
