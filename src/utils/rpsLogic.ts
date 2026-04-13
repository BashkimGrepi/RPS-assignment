import { Throw, LegacyGame, Outcome } from "../types/rps-dto.js";
import { Move, MatchResultType } from "../../generated/prisma/enums.js";


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

export const getResultType = (result: Outcome): MatchResultType => {
  if (result === "PLAYER_A") return MatchResultType.PLAYER_A_WIN;
  if (result === "PLAYER_B") return MatchResultType.PLAYER_B_WIN;
  return MatchResultType.DRAW;
};


export const stringToMove = (move: string): Move => {
  const normalized = move.toUpperCase();
  if (normalized === "ROCK") return Move.ROCK;
  if (normalized === "PAPER") return Move.PAPER;
  if (normalized === "SCISSORS") return Move.SCISSORS;
  throw new Error(`Invalid move: ${move}`);
};
