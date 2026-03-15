import { prisma } from "../lib/prisma.js";
import type { Player, Match } from "../../generated/prisma/client.js";
import { TransformedMatch } from "../transformers/matchTransformer.js";

/**
 * Find or create a player by name
 * Uses upsert to handle deduplication via unique name constraint
 *
 * @param name - Player name
 * @returns Player record
 */
export const upsertPlayer = async (name: string): Promise<Player> => {
  return await prisma.player.upsert({
    where: { name },
    update: {}, // If player exists, don't update anything
    create: { name },
  });
};

/**
 * Upsert a match by gameId with full deduplication
 * Ensures both players exist first, then upserts the match
 *
 * If match with same gameId already exists:
 * - Updates only the ingestedFrom field (to track multiple sources)
 *
 * @param transformedMatch - Transformed match data ready for database
 * @returns Match record
 */
export const upsertMatch = async (transformedMatch: TransformedMatch): Promise<Match> => {
  // Step 1: Ensure both players exist in database
  const [playerA, playerB] = await Promise.all([
    upsertPlayer(transformedMatch.playerAName),
    upsertPlayer(transformedMatch.playerBName),
  ]);

  // Step 2: Get winner/loser player IDs
  let winnerPlayerId: number | null = null;
  let loserPlayerId: number | null = null;

  if (transformedMatch.winnerPlayerName) {
    // Winner will be one of the two players we just upserted
    if (transformedMatch.winnerPlayerName === transformedMatch.playerAName) {
      winnerPlayerId = playerA.id;
    } else {
      winnerPlayerId = playerB.id;
    }
  }

  if (transformedMatch.loserPlayerName) {
    // Loser will be one of the two players we just upserted
    if (transformedMatch.loserPlayerName === transformedMatch.playerAName) {
      loserPlayerId = playerA.id;
    } else {
      loserPlayerId = playerB.id;
    }
  }

  // Step 3: Upsert the match (deduplication by unique gameId)
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

/**
 * Batch upsert multiple matches efficiently
 * Processes matches sequentially to avoid conflicts
 *
 * @param transformedMatches - Array of transformed matches
 * @returns Array of upserted Match records
 */
export const upsertMatches = async (
  transformedMatches: TransformedMatch[],
): Promise<Match[]> => {
  const results: Match[] = [];

  // Process sequentially to avoid race conditions with player creation
  for (const transformedMatch of transformedMatches) {
    const match = await upsertMatch(transformedMatch);
    results.push(match);
  }

  return results;
};
