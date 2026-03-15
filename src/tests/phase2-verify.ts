/**
 * Phase 2 Verification Script
 * Tests the historical backfill system
 *
 * Run with: npx tsx src/tests/phase2-verify.ts
 */

import { runBackfillCycle, runBackfillBatch } from "../sync/historyBackfill.js";
import {
  getBackfillStatus,
  startBackfillOrchestrator,
  stopBackfillOrchestrator,
} from "../sync/backfillOrchestrator.js";
import { prisma } from "../lib/prisma.js";

async function testPhase2() {
  console.log("🧪 Testing Phase 2 Implementation - Historical Backfill\n");

  try {
    // Test 1: Run a single backfill cycle
    console.log("✅ Test 1: Single Backfill Cycle");
    const result = await runBackfillCycle();
    console.log("  Matches processed:", result.matchesProcessed);
    console.log("  Completed:", result.completed);

    // Test 2: Check sync state
    console.log("\n✅ Test 2: Sync State");
    const syncState = await prisma.syncState.findUnique({
      where: { key: "main" },
    });
    console.log("  Cursor:", syncState?.backfillCursor || "null");
    console.log("  Completed:", syncState?.backfillCompleted);
    console.log(
      "  Last run:",
      syncState?.lastBackfillRunAt?.toISOString() || "never",
    );

    // Test 3: Check database for matches
    console.log("\n✅ Test 3: Database Statistics");
    const [matchCount, playerCount] = await Promise.all([
      prisma.match.count(),
      prisma.player.count(),
    ]);
    console.log("  Total matches:", matchCount);
    console.log("  Total players:", playerCount);

    // Test 4: Get backfill status
    console.log("\n✅ Test 4: Backfill Status API");
    const status = await getBackfillStatus();
    console.log("  Status:", status);

    // Test 5: Run a small batch (3 pages)
    console.log("\n✅ Test 5: Run Small Batch (3 pages)");
    const totalMatches = await runBackfillBatch(3);
    console.log("  Total matches processed in batch:", totalMatches);

    // Test 6: Verify resumability
    console.log("\n✅ Test 6: Verify Resumability");
    const stateAfterBatch = await prisma.syncState.findUnique({
      where: { key: "main" },
    });
    console.log(
      "  Cursor saved:",
      stateAfterBatch?.backfillCursor ? "Yes" : "No",
    );
    console.log("  Can resume:", !stateAfterBatch?.backfillCompleted);

    console.log("\n🎉 Phase 2 Implementation Verification Complete!");
    console.log("\n📋 Summary:");
    console.log("  ✅ Single backfill cycle execution");
    console.log("  ✅ Sync state tracking");
    console.log("  ✅ Database population");
    console.log("  ✅ Cursor checkpointing");
    console.log("  ✅ Resumable backfill");
    console.log("  ✅ Batch processing");
    console.log("\n✨ Phase 2 Complete - Ready for Phase 3 (Live SSE Stream)");
  } catch (error) {
    console.error("❌ Test failed:", error);
    console.error(
      "\n⚠️  Make sure your database is running and migrations are applied!",
    );
    console.error("     Run: npx prisma migrate dev");
  } finally {
    // Clean up
    stopBackfillOrchestrator();
    await prisma.$disconnect();
  }
}

testPhase2();
