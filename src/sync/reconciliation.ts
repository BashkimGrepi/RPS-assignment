/**
 * Periodic Reconciliation Module
 *
 * Fills gaps from missed SSE events by periodically fetching the newest history page.
 * This ensures we don't miss matches if the SSE stream disconnects or drops events.
 *
 * Strategy: Fetch only the first page of /history (newest matches) and upsert them.
 * Duplicate detection via gameId ensures no data duplication.
 */

import { fetchHistoryPage } from "../services/legacy-api.service.js";
import { transformLegacyMatch } from "../transformers/matchTransformer.js";
import { upsertMatches } from "../db/upsertHelpers.js";
import { prisma } from "../lib/prisma.js";
import { SyncSource } from "../../generated/prisma/enums.js";
import { ReconciliationResult, ReconciliationStopReason } from "../types/reconciliations.js";
import { env } from "../config/env.js";
import { MAX_RECONCILIATION_PAGES } from "../config/constants.js";


const SYNC_STATE_KEY = env.SYNC_STATE_KEY;

// Main function to run a reconciliation cycle
// Scans pages and upserts matches until it hits a stopping condition (duplicate page, max pages, no more data)
export async function runReconciliationCycle(): Promise<ReconciliationResult> {
  console.log("Starting reconciliation cycle...");

  let cursor: string | undefined = undefined; // Start with the newest page (no cursor)
  let totalPagesScanned = 0;
  let totalMatchesSeen = 0;
  let totalInserted = 0;
  let totalDuplicates = 0;
  let stoppedBecause: ReconciliationStopReason = "max_pages_reached";

  let newestKnownMatch: { gameId: string; time: number } | null = null;

  
  try {
    // Update sync state to mark reconciliation start
    await prisma.syncState.upsert({
      where: { key: SYNC_STATE_KEY },
      update: { lastReconcileRunAt: new Date() },
      create: {
        key: SYNC_STATE_KEY,
        lastReconcileRunAt: new Date(),
      },
    });

    while (totalPagesScanned < MAX_RECONCILIATION_PAGES) {
      console.log("fetching history page with cursor:", cursor);
      const page = await fetchHistoryPage(cursor);
      
      if (page.data.length === 0) {
        stoppedBecause = "no_more_data";
        console.log("no more data to fetch from history API");
        break;
      }

      totalPagesScanned++;
      totalMatchesSeen += page.data.length;
      console.log(`Fetched page ${totalPagesScanned} with ${page.data.length} matches`);
     
      for (const legacyGame of page.data) {
        const matchTime = new Date(legacyGame.time).getTime();
        if (!newestKnownMatch || matchTime > newestKnownMatch.time) {
          newestKnownMatch = {
            gameId: legacyGame.gameId,
            time: legacyGame.time,
          };
        }
      }
      const transformedMatches = page.data.map((legacyGame) => transformLegacyMatch(legacyGame, SyncSource.HISTORY_RECONCILIATION));
      
      
      const [upsertedMatches, insertedCount, duplicateCount] = await upsertMatches(transformedMatches);
      totalInserted += insertedCount;
      totalDuplicates += duplicateCount;

      const isDuplicatedPage: boolean = insertedCount === 0 && duplicateCount > 0;

      if (isDuplicatedPage) {
        console.log("Reconciliation stopped due to duplicate page")
        stoppedBecause = "duplicate_page";
        break;
      }

      if (!page.cursor) {
        console.log("stopping reconciliation - no cursor for next page");
        stoppedBecause = "no_more_data";
        break;
      }

      cursor = page.cursor;

      // update syncState schema to have data about the newest known match
      //if (newestKnownMatch) {
      //  const syncState = await prisma.syncState.findUnique({
      //    where: { key: SYNC_STATE_KEY },
      //    data: {
      //      latestKnownMAtchTime: new Date(newestKnownMatch.time),
      //      latestKnownGameId: newestKnownMatch.gameId,
      //    }
      //  })
      //}
    }
    const results = {
      pagesScanned: totalPagesScanned,
      matchesSeen: totalMatchesSeen,
      insertedCount: totalInserted,
      duplicateCount: totalDuplicates,
      stoppedBecause,

    };
  
    console.log("Reconciliation cycle completed:");
    return results;
  } catch (error) {
    console.error("Error during reconciliation cycle:", error);
    throw error;
  }
}
