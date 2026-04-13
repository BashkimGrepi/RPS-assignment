// History Backfill Module
// this module handles the historical backfill process, fetching old mathches from the legacy api /history
// fills our database with historical matches


// Rules for backfill:
// old idea was that duplicate page from the legacy api means its completed. 
// End is when we dont have a cursor for the next page or when we get an empty page.

import { fetchHistoryPage } from "../services/legacy-api.service.js";
import { transformLegacyMatch } from "../transformers/matchTransformer.js";
import { upsertMatch } from "../db/upsertHelpers.js";
import { prisma } from "../lib/prisma.js";
import { SyncSource } from "../../generated/prisma/enums.js";
import { env } from "../config/env.js";

const SYNC_STATE_KEY = env.SYNC_STATE_KEY;
let currentLatest: Date | null = null;
let matchTime: Date | null = null;
let latestKnownGameId: string | null = null;
let matchesSeen: number | null = null;
let matchesDublicates: number | null = null;
let matchesInserted: number | null = null;


// get or create sync state
async function ensureSyncState() {
  return await prisma.syncState.upsert({
    where: { key: SYNC_STATE_KEY },
    update: {},
    create: {
      key: SYNC_STATE_KEY,
      backfillCursor: null,
      backfillCompleted: false,
      isBackfillRunning: false,
    },
  });
}


async function getExistingGameIds(gameIds: string[]) {
  // Check which gameIds already exist in the database
  const existingMatches = await prisma.match.findMany({
    where: {
      gameId: { in: gameIds },
    },
    select: { gameId: true },
  });

  const existingGameIds = new Set(existingMatches.map((m) => m.gameId));
  return existingGameIds;
}



// runs one cycle of the backfill process - fetches one page, processes it, updates cursor and state 
export async function runBackfillCycle(): Promise<{
  completed: boolean;
  matchesSeen: number;
  matchesInserted: number;
  matchesDublicates: number;
  stoppedBecause: "EMPTY_PAGE" | "NO_NEXT_CURSOR" | "IN_PROGRESS" | "ALREADY_COMPLETED" | "ERROR";}> {
  // Get current sync state
  const syncState = await ensureSyncState();
  
  // Check if already completed
  if (syncState.backfillCompleted) {
    console.log(" Backfill already completed");
    return { completed: true, matchesSeen: 0, matchesInserted: 0, matchesDublicates: 0, stoppedBecause: "ALREADY_COMPLETED" };
  }

  // Mark backfill as running
  await prisma.syncState.update({
    where: { key: SYNC_STATE_KEY },
    data: { isBackfillRunning: true, lastBackfillRunAt: new Date() },
  });

  try {
    // Fetch next page using saved cursor
    console.log(
      `Fetching history page (cursor: ${syncState.backfillCursor || "start"})...`,
    );
    const page = await fetchHistoryPage(syncState.backfillCursor || undefined);

    // If no data, we've reached the end
    if (page.data.length === 0) {
      console.log("No more data - backfill complete!");
      await prisma.syncState.update({
        where: { key: SYNC_STATE_KEY },
        data: {
          backfillCompleted: true,
          isBackfillRunning: false,
          backfillCursor: null,
        },
      });
      return { completed: true, matchesSeen: 0, matchesInserted: 0, matchesDublicates: 0, stoppedBecause: "EMPTY_PAGE" };
    }

    // Process each match - check for duplicates BEFORE saving


    const duplicateGameIds = await getExistingGameIds(page.data.map(g => g.gameId));
  
    for (const legacyGame of page.data) {
      try {

        if (duplicateGameIds.has(legacyGame.gameId)) {
          matchesDublicates = (matchesDublicates || 0) + 1;
          matchesSeen = (matchesSeen || 0) + 1;
          continue; // Skip, already have it
        }

        // Only save NEW games
        const transformed = transformLegacyMatch(
          legacyGame,
          SyncSource.HISTORY_BACKFILL,
        );
        await upsertMatch(transformed);
        matchesInserted = (matchesInserted || 0) + 1;
        matchesSeen = (matchesSeen || 0) + 1;

        // Update latest known match info
        matchTime = new Date(legacyGame.time);
        currentLatest = syncState.latestKnownMatchTime;

        if (!currentLatest || matchTime > currentLatest) {
          currentLatest = matchTime;
          latestKnownGameId = legacyGame.gameId;
        }

        
      } catch (error) {
        // Log, but continue processing other matches
        console.error(`Error processing match ${legacyGame.gameId}:`, error);
      }
    }

    if (currentLatest) {
      await prisma.syncState.update({
        where: { key: SYNC_STATE_KEY },
        data: {
          latestKnownMatchTime: matchTime,
          latestKnownGameId: latestKnownGameId,
        },
      });
    }

    console.log(
      `Processed ${matchesInserted} new matches, ${matchesDublicates} duplicates`,
    );

    // if all were dublicates, we might have reached the end,
    // but for safety we will continue until empty page or no cursor to avoid false positives
    const allDuplicates = matchesInserted === 0 && matchesDublicates && matchesDublicates > 0;

    if (allDuplicates) {
      console.log("All games in this page are duplicates... continuing to next page");
    }


    // Save cursor for next iteration
    if (page.cursor) {
      await prisma.syncState.update({
        where: { key: SYNC_STATE_KEY },
        data: {
          backfillCursor: page.cursor,
          isBackfillRunning: false,
        },
      });
      return {
        completed: false,
        matchesSeen: matchesSeen || 0,
        matchesInserted: matchesInserted || 0,
        matchesDublicates: matchesDublicates || 0,
        stoppedBecause: "IN_PROGRESS",
      };
    } else {
      // No cursor = end of data
      console.log("No more pages - backfill complete!");
      await prisma.syncState.update({
        where: { key: SYNC_STATE_KEY },
        data: {
          backfillCompleted: true,
          isBackfillRunning: false,
          backfillCursor: null,
        },
      });
      return {
        completed: true,
        matchesSeen: matchesSeen || 0,
        matchesInserted: matchesInserted || 0,
        matchesDublicates: matchesDublicates || 0,
        stoppedBecause: "EMPTY_PAGE",
      };
    }
  } catch (error) {
    await prisma.syncState.update({
      where: { key: SYNC_STATE_KEY },
      data: { isBackfillRunning: false },
    });
    throw error;
  }
}



