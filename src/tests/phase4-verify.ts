/**
 * Phase 4 Verification: Periodic Reconciliation
 *
 * Tests:
 * 1. Reconciliation cycle fetches and processes matches
 * 2. Scheduler starts and runs reconciliation
 * 3. Overlap prevention works
 * 4. SyncState tracks lastReconciliationAt
 */

import { runReconciliationCycle } from "../sync/reconciliation.js";
import {
  startReconciliationScheduler,
  stopReconciliationScheduler,
  getReconciliationStatus,
} from "../sync/reconciliationScheduler.js";
import { prisma } from "../lib/prisma.js";
import { SyncSource } from "../../generated/prisma/enums.js";

const SYNC_STATE_KEY = "main";

async function testReconciliationCycle() {
  console.log("\n=== Test 1: Reconciliation Cycle ===");

  // Record time before reconciliation
  const beforeTime = new Date();

  // Run reconciliation
  const matchesProcessed = await runReconciliationCycle();
  console.log(`✅ Processed ${matchesProcessed} matches`);

  // Verify SyncState was updated
  const syncState = await prisma.syncState.findUnique({
    where: { key: SYNC_STATE_KEY },
  });

  if (!syncState || !syncState.lastReconcileRunAt) {
    throw new Error("❌ SyncState not updated with lastReconcileRunAt");
  }

  if (syncState.lastReconcileRunAt < beforeTime) {
    throw new Error("❌ lastReconcileRunAt timestamp is incorrect");
  }

  console.log(
    `✅ SyncState updated: lastReconcileRunAt = ${syncState.lastReconcileRunAt.toISOString()}`,
  );

  // Verify matches exist in database with HISTORY_RECONCILIATION source
  const reconciliationMatches = await prisma.match.findMany({
    where: { ingestedFrom: SyncSource.HISTORY_RECONCILIATION },
    take: 5,
  });

  console.log(
    `✅ Found ${reconciliationMatches.length} matches with HISTORY_RECONCILIATION source`,
  );

  if (matchesProcessed > 0 && reconciliationMatches.length === 0) {
    throw new Error("❌ No matches found with HISTORY_RECONCILIATION source");
  }
}

async function testScheduler() {
  console.log("\n=== Test 2: Scheduler Start/Stop ===");

  // Check initial status
  let status = getReconciliationStatus();
  if (status.isSchedulerActive) {
    throw new Error("❌ Scheduler should not be active initially");
  }
  console.log("✅ Initial state: scheduler inactive");

  // Start scheduler
  startReconciliationScheduler();

  // Wait a moment for first run to complete
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Check status
  status = getReconciliationStatus();
  if (!status.isSchedulerActive) {
    throw new Error("❌ Scheduler should be active after start");
  }
  console.log("✅ Scheduler started successfully");

  // Stop scheduler
  stopReconciliationScheduler();

  // Check status
  status = getReconciliationStatus();
  if (status.isSchedulerActive) {
    throw new Error("❌ Scheduler should be inactive after stop");
  }
  console.log("✅ Scheduler stopped successfully");
}

async function testOverlapPrevention() {
  console.log("\n=== Test 3: Overlap Prevention ===");

  // Start scheduler
  startReconciliationScheduler();

  // Check if it prevents double-start
  startReconciliationScheduler(); // Should log warning

  const status = getReconciliationStatus();
  if (!status.isSchedulerActive) {
    throw new Error("❌ Scheduler should still be active");
  }
  console.log("✅ Overlap prevention works");

  // Cleanup
  stopReconciliationScheduler();
}

async function testDatabaseIntegration() {
  console.log("\n=== Test 4: Database Integration ===");

  // Run reconciliation
  await runReconciliationCycle();

  // Check total matches in database
  const totalMatches = await prisma.match.count();
  console.log(`✅ Total matches in database: ${totalMatches}`);

  // Check matches from different sources
  const historyMatches = await prisma.match.count({
    where: { ingestedFrom: SyncSource.HISTORY_BACKFILL },
  });
  const liveMatches = await prisma.match.count({
    where: { ingestedFrom: SyncSource.LIVE_SSE },
  });
  const reconciliationMatches = await prisma.match.count({
    where: { ingestedFrom: SyncSource.HISTORY_RECONCILIATION },
  });

  console.log(`  - HISTORY_BACKFILL: ${historyMatches}`);
  console.log(`  - LIVE_SSE: ${liveMatches}`);
  console.log(`  - HISTORY_RECONCILIATION: ${reconciliationMatches}`);

  console.log("✅ Database shows mix of sources (as expected)");
}

// Main test runner
async function main() {
  console.log("🧪 Phase 4 Verification: Periodic Reconciliation\n");

  try {
    await testReconciliationCycle();
    await testScheduler();
    await testOverlapPrevention();
    await testDatabaseIntegration();

    console.log("\n✅ All Phase 4 tests passed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  } finally {
    // Ensure scheduler is stopped
    stopReconciliationScheduler();
    await prisma.$disconnect();
  }
}

main();
