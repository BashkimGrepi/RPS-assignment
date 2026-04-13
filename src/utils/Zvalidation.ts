import { z } from "zod";

export const isValidUtcDateString = (value: string): boolean => {
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const utcDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine(isValidUtcDateString, {
    message: "Invalid UTC date format",
  });

export const getMatchesSchema = z.object({
    date: utcDateSchema.optional(),
    playerName: z
      .string()
      .trim()
      .min(2, "Player name must be at least 2 characters long")
      .max(50, "Player name must be at most 50 characters long")
      .optional(),
  })
  .strict();

export const sortBySchema = z
  .object({
    sortBy: z.enum(["wins", "winRate"]).optional().default("wins"),
  })
  .strict();



export const historyLeaderboardQuerySchema = z
  .object({
    from: utcDateSchema.refine(isValidUtcDateString, {
      message: "Invalid UTC date format for 'from'",
    }),
    to: utcDateSchema.refine(isValidUtcDateString, {
      message: "Invalid UTC date format for 'to'",
    }),
    sortBy: z.enum(["wins", "winRate"]).optional().default("wins"),
  })
  .strict()
  .refine((data) => data.from <= data.to, {
    message: "'from' date must be less than or equal to 'to' date",
    path: ["from"],
  });


export const legacyGameSchema = z.object({
  type: z.literal("GAME_RESULT"),
  gameId: z.string().min(1),
  time: z.number().int().positive(),
  playerA: z.object({
    name: z.string().min(1).max(50),
    played: z.enum(["ROCK", "PAPER", "SCISSORS"]),
  }),
  playerB: z.object({
    name: z.string().min(1).max(50),
    played: z.enum(["ROCK", "PAPER", "SCISSORS"]),
  }),
}).strict();
