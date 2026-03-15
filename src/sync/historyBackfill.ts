/**
 * Historical Backfill Module
 * 
 * Progressively imports historical match data from legacy API using checkpointed cursor pagination.
 * Designed to be resumable - can stop/restart without losing progress.
 */

import { fetchHistoryPage } from "../services/legacy-api.service.js";
import { transformLegacyMatch } from "../transformers/matchTransformer.js";
import { upsertMatch } from "../db/upsertHelpers.js";
import { prisma } from "../lib/prisma.js";
import { SyncSource } from "../../generated/prisma/enums.js";

const SYNC_STATE_KEY = "main";
const DELAY_BETWEEN_PAGES_MS = 100; // Rate limiting to avoid overwhelming API

/**
 * Get or create the main sync state record
 */
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

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run a single backfill cycle
 * Fetches one page, processes all matches, saves cursor
 * 
 * @returns Object with completion status and matches processed
 */
export async function runBackfillCycle(): Promise<{
    completed: boolean;
    matchesProcessed: number;
    pageNumber: number;
}> {
    // Get current sync state
    const syncState = await ensureSyncState();
    
    // Check if already completed
    if (syncState.backfillCompleted) {
        console.log("📦 Backfill already completed");
        return { completed: true, matchesProcessed: 0, pageNumber: 0 };
    }
    
    // Mark backfill as running
    await prisma.syncState.update({
        where: { key: SYNC_STATE_KEY },
        data: { isBackfillRunning: true, lastBackfillRunAt: new Date() },
    });
    
    try {
        // Fetch next page using saved cursor
        console.log(`📥 Fetching history page (cursor: ${syncState.backfillCursor || 'start'})...`);
        const page = await fetchHistoryPage(syncState.backfillCursor || undefined);
        
        // If no data, we've reached the end
        if (page.data.length === 0) {
            console.log("✅ No more data - backfill complete!");
            await prisma.syncState.update({
                where: { key: SYNC_STATE_KEY },
                data: {
                    backfillCompleted: true,
                    isBackfillRunning: false,
                    backfillCursor: null,
                },
            });
            return { completed: true, matchesProcessed: 0, pageNumber: 0 };
        }
        
        // Process each match in the page
        let processedCount = 0;
        for (const legacyGame of page.data) {
            try {
                // Transform to database format
                const transformed = transformLegacyMatch(legacyGame, SyncSource.HISTORY_BACKFILL);
                
                // Upsert into database (deduplication handled by gameId unique constraint)
                await upsertMatch(transformed);
                processedCount++;
                
                // Update latest known match info
                const matchTime = new Date(legacyGame.time);
                const currentLatest = syncState.latestKnownMatchTime;
                if (!currentLatest || matchTime > currentLatest) {
                    await prisma.syncState.update({
                        where: { key: SYNC_STATE_KEY },
                        data: {
                            latestKnownMatchTime: matchTime,
                            latestKnownGameId: legacyGame.gameId,
                        },
                    });
                }
            } catch (error) {
                // Log error but continue processing other matches
                console.error(`❌ Error processing match ${legacyGame.gameId}:`, error);
            }
        }
        
        console.log(`✅ Processed ${processedCount}/${page.data.length} matches`);
        
        // Save cursor for next iteration
        if (page.cursor) {
            await prisma.syncState.update({
                where: { key: SYNC_STATE_KEY },
                data: {
                    backfillCursor: page.cursor,
                    isBackfillRunning: false,
                },
            });
            return { completed: false, matchesProcessed: processedCount, pageNumber: 1 };
        } else {
            // No cursor = end of data
            console.log("✅ No more pages - backfill complete!");
            await prisma.syncState.update({
                where: { key: SYNC_STATE_KEY },
                data: {
                    backfillCompleted: true,
                    isBackfillRunning: false,
                    backfillCursor: null,
                },
            });
            return { completed: true, matchesProcessed: processedCount, pageNumber: 1 };
        }
        
    } catch (error) {
        // Mark as not running on error
        await prisma.syncState.update({
            where: { key: SYNC_STATE_KEY },
            data: { isBackfillRunning: false },
        });
        throw error;
    }
}

/**
 * Run multiple backfill cycles until completion or max cycles reached
 * 
 * @param maxCycles - Maximum number of pages to fetch (default: unlimited)
 * @returns Total matches processed
 */
export async function runBackfillBatch(maxCycles: number = Infinity): Promise<number> {
    let totalMatches = 0;
    let cycleCount = 0;
    
    console.log(`🚀 Starting backfill batch (max ${maxCycles === Infinity ? 'unlimited' : maxCycles} cycles)...`);
    
    while (cycleCount < maxCycles) {
        const result = await runBackfillCycle();
        totalMatches += result.matchesProcessed;
        cycleCount++;
        
        if (result.completed) {
            console.log(`🎉 Backfill completed after ${cycleCount} cycles, ${totalMatches} total matches processed`);
            break;
        }
        
        // Log progress every 10 pages
        if (cycleCount % 10 === 0) {
            console.log(`📊 Progress: ${cycleCount} pages, ${totalMatches} matches processed so far...`);
        }
        
        // Rate limiting delay
        await delay(DELAY_BETWEEN_PAGES_MS);
    }
    
    return totalMatches;
}
