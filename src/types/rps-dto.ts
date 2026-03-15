export type Throw = "ROCK" | "PAPER" | "SCISSORS";
export type Outcome = "PLAYER_A" | "PLAYER_B" | "TIE";
export type GameType = "GAME_RESULT";

export interface NormalizedGame {
    gameId: string;
    time: number; // this is in ms used for sorting,
    date: string;   // yyyy-mm-dd
    playerA: {
        name: string;
        played: Throw;
    };
    playerB: {
        name: string;
        played: Throw;
    };
    winner: string | null;
    isTie: boolean;
}

export interface LegacyGame {
    type: string;
    gameId: string;
    time: number;
    playerA: {
        name: string;
        played: Throw;
    };
    playerB: {
        name: string;
        played: Throw;
    }

}