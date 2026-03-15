import {
  SyncSource,
  Move,
  MatchResultType,
} from "../../generated/prisma/enums.js";
import { LegacyGame } from "../types/rps-dto.js";
import {
  determineWinner,
  getResultType,
  stringToMove,
} from "../utils/rpsLogic.js";

/**
 * Transformed match ready for database insertion
 * This is the intermediate format between LegacyGame and Prisma Match model
 */
export interface TransformedMatch {
  gameId: string;
  playedAt: Date;
  playedDate: Date;
  playerAName: string;
  playerBName: string;
  playerAChoice: Move;
  playerBChoice: Move;
  resultType: MatchResultType;
  winnerPlayerName: string | null;
  loserPlayerName: string | null;
  ingestedFrom: SyncSource;
}

/**
 * Transform legacy API match data into database-ready format
 *
 * @param legacyGame - Raw match data from legacy API
 * @param source - Where this match came from (HISTORY_BACKFILL, LIVE_SSE, etc.)
 * @returns TransformedMatch ready for database insertion
 */
export const transformLegacyMatch = (legacyGame: LegacyGame, source: SyncSource): TransformedMatch => {
  // Convert string moves to Prisma Move enum
  const playerAChoice = stringToMove(legacyGame.playerA.played);
  const playerBChoice = stringToMove(legacyGame.playerB.played);

  // Determine winner
  const outcome = determineWinner(playerAChoice, playerBChoice);
  const resultType = getResultType(outcome);

  // Convert timestamp to Date objects
  const playedAt = new Date(legacyGame.time);
  // playedDate should be date-only (normalized to midnight UTC)
  const playedDate = new Date(
    playedAt.toISOString().split("T")[0] + "T00:00:00.000Z",
  );

  // Determine winner and loser names
  let winnerPlayerName: string | null = null;
  let loserPlayerName: string | null = null;

  if (outcome === "PLAYER_A") {
    winnerPlayerName = legacyGame.playerA.name;
    loserPlayerName = legacyGame.playerB.name;
  } else if (outcome === "PLAYER_B") {
    winnerPlayerName = legacyGame.playerB.name;
    loserPlayerName = legacyGame.playerA.name;
  }
  // If TIE, both remain null

  return {
    gameId: legacyGame.gameId,
    playedAt,
    playedDate,
    playerAName: legacyGame.playerA.name,
    playerBName: legacyGame.playerB.name,
    playerAChoice,
    playerBChoice,
    resultType,
    winnerPlayerName,
    loserPlayerName,
    ingestedFrom: source,
  };
};
