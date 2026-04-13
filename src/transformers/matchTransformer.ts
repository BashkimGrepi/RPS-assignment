import {
  SyncSource,
  Move,
  MatchResultType,
} from "../../generated/prisma/enums.js";
import { LegacyGame } from "../types/rps-dto.js";
import { TransformedMatch } from "../types/rps-dto.js";
import {
  determineWinner,
  getResultType,
  stringToMove,
} from "../utils/rpsLogic.js";
import { legacyGameSchema } from "../utils/Zvalidation.js";


// Transform LegacyGame to TransformedMatch format for database insertion
export const transformLegacyMatch = (legacyGame: LegacyGame, source: SyncSource): TransformedMatch => {
  
  // Validate legacy game data
  const validLGame = legacyGameSchema.safeParse(legacyGame);
  if (!validLGame.success) {
    throw new Error(`Invalid legacy game data: ${JSON.stringify(legacyGame)}. Errors: ${JSON.stringify(validLGame.error.issues)}`);
  }


  // Convert string moves to Prisma Move enum
  const playerAChoice = stringToMove(validLGame.data.playerA.played);
  const playerBChoice = stringToMove(validLGame.data.playerB.played);

  // results
  const outcome = determineWinner(playerAChoice, playerBChoice);
  const resultType = getResultType(outcome);

  // timestaps are in ms, converts to date obwjects
  const playedAt = new Date(validLGame.data.time);
  // (normalized to midnight UTC)
  const playedDate = new Date(
    playedAt.toISOString().split("T")[0] + "T00:00:00.000Z",
  );

 
  let winnerPlayerName: string | null = null;
  let loserPlayerName: string | null = null;

  if (outcome === "PLAYER_A") {    
    winnerPlayerName = validLGame.data.playerA.name;
    loserPlayerName = validLGame.data.playerB.name;

  } else if (outcome === "PLAYER_B") {
    winnerPlayerName = validLGame.data.playerB.name;
    loserPlayerName = validLGame.data.playerA.name;
  }
  // If TIE, both remain null


  return {
    gameId: validLGame.data.gameId,
    playedAt,
    playedDate,
    playerAName: validLGame.data.playerA.name,
    playerBName: validLGame.data.playerB.name,
    playerAChoice,
    playerBChoice,
    resultType,
    winnerPlayerName,
    loserPlayerName,
    ingestedFrom: source,
  };
};
