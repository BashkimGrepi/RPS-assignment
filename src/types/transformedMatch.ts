import { MatchResultType, Move, SyncSource } from "../../generated/prisma/enums.js";

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
