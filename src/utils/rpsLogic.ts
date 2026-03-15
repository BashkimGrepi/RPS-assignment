// rps logic
import { NormalizedGame, Throw, LegacyGame, Outcome } from "../types/rps-dto.js";
import { Move, MatchResultType } from "../../generated/prisma/enums.js";


const beats: Record<Throw, Throw> = {
  ROCK: "SCISSORS",
  PAPER: "ROCK",
  SCISSORS: "PAPER",
};

const determineOutcome = (throwA: Throw, throwB: Throw): Outcome => {
  if (throwA === throwB) return "TIE";
  if (beats[throwA] === throwB) return "PLAYER_A";
  return "PLAYER_B";
};


 // Normalize legacy game data to API response format

export const normalizeGameOutcome = (raw: LegacyGame): NormalizedGame => {
  const outcome = determineOutcome(raw.playerA.played, raw.playerB.played);
  const winner =
    outcome === "TIE"
      ? null
      : outcome === "PLAYER_A"
        ? raw.playerA.name
        : raw.playerB.name;
  return {
    gameId: raw.gameId,
    time: raw.time,
    date: new Date(raw.time).toISOString().split("T")[0],
    playerA: {
      name: raw.playerA.name,
      played: raw.playerA.played,
    },
    playerB: {
      name: raw.playerB.name,
      played: raw.playerB.played,
    },
    winner,
    isTie: outcome === "TIE",
  };
};

// determine winner using prisma move
export const determineWinner = (choiceA: Move, choiceB: Move): Outcome => {
  const beatsMap: Record<Move, Move> = {
    ROCK: Move.SCISSORS,
    PAPER: Move.ROCK,
    SCISSORS: Move.PAPER,
  };

  if (choiceA === choiceB) return "TIE";
  if (beatsMap[choiceA] === choiceB) return "PLAYER_A";
  return "PLAYER_B";
};

/**
 * Convert winner outcome to Prisma MatchResultType enum
 */
export const getResultType = (result: Outcome): MatchResultType => {
  if (result === "PLAYER_A") return MatchResultType.PLAYER_A_WIN;
  if (result === "PLAYER_B") return MatchResultType.PLAYER_B_WIN;
  return MatchResultType.DRAW;
};

/**
 * Convert string move to Prisma Move enum
 * Throws error if invalid move
 */
export const stringToMove = (move: string): Move => {
  const normalized = move.toUpperCase();
  if (normalized === "ROCK") return Move.ROCK;
  if (normalized === "PAPER") return Move.PAPER;
  if (normalized === "SCISSORS") return Move.SCISSORS;
  throw new Error(`Invalid move: ${move}`);
};
