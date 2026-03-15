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

const SYNC_STATE_KEY = "main";

/**
 * Run a single reconciliation cycle
 * Fetches the first page of history (newest matches) and upserts them
 *
 * @returns Number of matches processed
 */
export async function runReconciliationCycle(): Promise<number> {
  console.log("🔄 Starting reconciliation cycle...");

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

    // Fetch ONLY the first page (newest matches)
    // No cursor = start from beginning (most recent)
    const page = await fetchHistoryPage();

    if (page.data.length === 0) {
      console.log("⚠️ No data returned from history API during reconciliation");
      return 0;
    }

    console.log(`📥 Fetched ${page.data.length} matches for reconciliation`);

    // Transform all matches to database format
    const transformedMatches = page.data.map((legacyGame) =>
      transformLegacyMatch(legacyGame, SyncSource.HISTORY_RECONCILIATION),
    );

    // Upsert all matches (deduplication handled automatically)
    await upsertMatches(transformedMatches);

    console.log(
      `✅ Reconciliation complete - processed ${transformedMatches.length} matches`,
    );

    // Update latest known match info (newest match in the page)
    if (page.data.length > 0) {
      // First match in history page is the newest
      const newestMatch = page.data[0];
      const matchTime = new Date(newestMatch.time);

      const syncState = await prisma.syncState.findUnique({
        where: { key: SYNC_STATE_KEY },
      });

      const currentLatest = syncState?.latestKnownMatchTime;
      if (!currentLatest || matchTime > currentLatest) {
        await prisma.syncState.update({
          where: { key: SYNC_STATE_KEY },
          data: {
            latestKnownMatchTime: matchTime,
            latestKnownGameId: newestMatch.gameId,
          },
        });
      }
    }

    return transformedMatches.length;
  } catch (error) {
    console.error("❌ Reconciliation cycle failed:", error);
    throw error;
  }
}
