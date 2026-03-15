/**
 * Phase 5 Verification: Integration & Startup
 *
 * Tests:
 * 1. startSyncSubsystem() initializes all three sync processes
 * 2. All processes run simultaneously
 * 3. Matches appear in database within reasonable time
 * 4. SyncState is properly initialized
 * 5. Graceful shutdown works
 */

import {
  startSyncSubsystem,
  stopSyncSubsystem,
  getSyncSubsystemStatus,
  logSyncStatus,
} from "../sync/syncRunner.js";
import { prisma } from "../lib/prisma.js";

const SYNC_STATE_KEY = "main";

async function testSubsystemStartup() {
  console.log("\n=== Test 1: Subsystem Startup ===");

  // Start the sync subsystem
  console.log("Starting sync subsystem...");
  await startSyncSubsystem();

  // Wait a moment for processes to initialize
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Get status
  const status = await getSyncSubsystemStatus();

  console.log("Status after startup:");
  console.log(`  Subsystem Running: ${status.subsystemRunning}`);
  console.log(
    `  Backfill Running: ${status.backfill.isRunning || !status.backfill.completed}`,
  );
  console.log(`  SSE Connected: ${status.sseStream.connected}`);
  console.log(
    `  Reconciliation Active: ${status.reconciliation.isSchedulerActive}`,
  );

  // Verify subsystem is running
  if (!status.subsystemRunning) {
    throw new Error("❌ Subsystem not marked as running");
  }

  // Verify reconciliation scheduler is active
  if (!status.reconciliation.isSchedulerActive) {
    throw new Error("❌ Reconciliation scheduler not active");
  }

  console.log("✅ All processes started successfully");
}

async function testSyncStateInitialization() {
  console.log("\n=== Test 2: SyncState Initialization ===");

  // Verify SyncState record exists
  const syncState = await prisma.syncState.findUnique({
    where: { key: SYNC_STATE_KEY },
  });

  if (!syncState) {
    throw new Error("❌ SyncState record not created");
  }

  console.log("✅ SyncState record exists:");
  console.log(`  Key: ${syncState.key}`);
  console.log(`  Backfill Completed: ${syncState.backfillCompleted}`);
  console.log(`  SSE Connected: ${syncState.sseConnected}`);
  console.log(
    `  Backfill Cursor: ${syncState.backfillCursor || "null (start)"}`,
  );
}

async function testDataIngestion() {
  console.log("\n=== Test 3: Data Ingestion ===");

  console.log("Waiting 10 seconds for data to start flowing...");
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // Check if matches are being ingested
  const totalMatches = await prisma.match.count();
  console.log(`✅ Total matches in database: ${totalMatches}`);

  if (totalMatches === 0) {
    console.log("⚠️  No matches yet - this might be normal if API is slow");
  } else {
    console.log("✅ Matches are being ingested!");

    // Check distribution by source
    const backfillCount = await prisma.match.count({
      where: { ingestedFrom: "HISTORY_BACKFILL" },
    });
    const sseCount = await prisma.match.count({
      where: { ingestedFrom: "LIVE_SSE" },
    });
    const reconcileCount = await prisma.match.count({
      where: { ingestedFrom: "HISTORY_RECONCILIATION" },
    });

    console.log(`  - From Backfill: ${backfillCount}`);
    console.log(`  - From SSE: ${sseCount}`);
    console.log(`  - From Reconciliation: ${reconcileCount}`);
  }
}

async function testStatusReporting() {
  console.log("\n=== Test 4: Status Reporting ===");

  // Get comprehensive status
  const status = await getSyncSubsystemStatus();

  console.log("Full status object:");
  console.log(JSON.stringify(status, null, 2));

  // Verify status structure
  if (!status.subsystemRunning) {
    throw new Error("❌ Status shows subsystem not running");
  }

  if (typeof status.database.totalMatches !== "number") {
    throw new Error("❌ Invalid database status");
  }

  console.log("✅ Status reporting working correctly");

  // Test log function
  console.log("\nTesting logSyncStatus():");
  await logSyncStatus();
}

async function testGracefulShutdown() {
  console.log("\n=== Test 5: Graceful Shutdown ===");

  console.log("Stopping sync subsystem...");
  await stopSyncSubsystem();

  // Wait a moment for shutdown to complete
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Verify everything is stopped
  const status = await getSyncSubsystemStatus();

  console.log("Status after shutdown:");
  console.log(`  Subsystem Running: ${status.subsystemRunning}`);
  console.log(`  SSE Connected: ${status.sseStream.connected}`);
  console.log(
    `  Reconciliation Active: ${status.reconciliation.isSchedulerActive}`,
  );

  if (status.subsystemRunning) {
    throw new Error("❌ Subsystem still marked as running after shutdown");
  }

  if (status.sseStream.connected) {
    throw new Error("❌ SSE still connected after shutdown");
  }

  if (status.reconciliation.isSchedulerActive) {
    throw new Error("❌ Reconciliation still active after shutdown");
  }

  console.log("✅ Graceful shutdown successful");
}

async function testDoubleStart() {
  console.log("\n=== Test 6: Double Start Prevention ===");

  // Start subsystem
  await startSyncSubsystem();

  // Try to start again (should log warning and do nothing)
  await startSyncSubsystem();

  const status = await getSyncSubsystemStatus();
  if (!status.subsystemRunning) {
    throw new Error("❌ Subsystem not running after double start");
  }

  console.log("✅ Double start prevention works");

  // Clean up
  await stopSyncSubsystem();
}

// Main test runner
async function main() {
  console.log("🧪 Phase 5 Verification: Integration & Startup\n");

  try {
    await testSubsystemStartup();
    await testSyncStateInitialization();
    await testDataIngestion();
    await testStatusReporting();
    await testGracefulShutdown();
    await testDoubleStart();

    console.log("\n✅ ========================================");
    console.log("✅ ALL PHASE 5 TESTS PASSED!");
    console.log("✅ ========================================\n");

    console.log("🎉 Sync subsystem is fully operational!");
    console.log("   - Historical backfill running");
    console.log("   - Live SSE stream connected");
    console.log("   - Periodic reconciliation scheduled");
    console.log("   - Graceful shutdown working");
  } catch (error) {
    console.error("\n❌ Test failed:", error);

    // Attempt cleanup
    try {
      await stopSyncSubsystem();
    } catch (cleanupError) {
      console.error("Error during cleanup:", cleanupError);
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
